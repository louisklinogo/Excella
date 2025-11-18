import {
  createAiTelemetryOptions,
  seedRequestContext,
  startTimer,
} from "@excella/logging";
import { mastra } from "@excella/mastra";
import { captureException, startSpan } from "@sentry/nextjs";
import type { UIMessage } from "ai";

type HitlChatRequestExtras = {
  webSearch?: boolean;
};

type HitlChatRequestBody = {
  messages: UIMessage[];
  body?: HitlChatRequestExtras;
  data?: HitlChatRequestExtras;
};

export function POST(request: Request): Promise<Response> {
  return seedRequestContext(request, async ({ logger: requestLogger }) => {
    const url = new URL(request.url);

    if (url.searchParams.get("sentryTest") === "1") {
      throw new Error("Sentry test error – manual verification trigger");
    }

    const { messages, body, data } =
      (await request.json()) as HitlChatRequestBody;

    const extras: HitlChatRequestExtras = body ?? data ?? {};

    const timer = startTimer();
    const provider =
      process.env.HITL_AGENT_PROVIDER ??
      process.env.MODEL_PROVIDER ??
      "unknown";
    const modelId =
      process.env.HITL_AGENT_MODEL_ID ?? process.env.MODEL_ID ?? "default";

    requestLogger.info("ai.request.start", {
      provider,
      model: modelId,
      hitl: true,
    });

    try {
      const telemetry = createAiTelemetryOptions(
        "ai-chat.hitl-chat",
        {
          provider,
          model: modelId,
          webSearch: extras.webSearch ?? false,
          hitl: true,
        },
        {
          recordInputs: false,
          recordOutputs: false,
        }
      );

      const stream = await startSpan(
        {
          op: "ai.request",
          name: `HITL Chat (${provider}/${modelId})`,
        },
        (span) => {
          span?.setAttribute("webSearch", extras.webSearch ?? false);

          const mastraMessages = messages
            .map((message) => {
              const text = message.parts
                ?.map((part) => (part.type === "text" ? part.text : ""))
                .join("\n")
                .trim();

              if (!text) {
                return null;
              }

              return {
                role: message.role,
                content: text,
              } as const;
            })
            .filter(
              (message): message is { role: string; content: string } =>
                message !== null
            );

          if (mastraMessages.length === 0) {
            throw new Error(
              "No valid user or assistant text content found for HITL agent."
            );
          }

          const agent = mastra.getAgent("humanInTheLoopAgent");

          return agent.stream(mastraMessages, {
            format: "aisdk",
            experimental_telemetry: telemetry,
          });
        }
      );

      const durationMs = Date.now() - timer.start;

      requestLogger.info("ai.request.done", {
        provider,
        model: modelId,
        durationMs,
        status: "ok",
        hitl: true,
      });

      const encoder = new TextEncoder();

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of stream.textStream) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    } catch (error) {
      const durationMs = Date.now() - timer.start;

      captureException(error);

      requestLogger.error("ai.request.done", {
        provider,
        model: modelId,
        durationMs,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        hitl: true,
      });

      throw error;
    }
  });
}
