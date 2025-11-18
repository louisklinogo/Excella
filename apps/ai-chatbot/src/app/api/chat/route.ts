import type { ExcelContextSnapshot } from "@excella/core/excel/context-snapshot";
import { mastra } from "@excella/mastra";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { RuntimeContext } from "@mastra/core/runtime-context";
import type { UIMessage } from "ai";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

export const maxDuration = 30;

type ChatRequestBody = {
  messages: UIMessage[];
  excelSnapshot?: ExcelContextSnapshot | null;
  mode?: "default" | "research";
};

export async function POST(request: Request): Promise<Response> {
  const { messages, excelSnapshot, mode } =
    (await request.json()) as ChatRequestBody;

  const isResearchMode = mode === "research";
  const agent = mastra.getAgent(
    isResearchMode ? "researchAgent" : "routingAgent"
  );

  // eslint-disable-next-line no-console
  console.log("[api/chat] excelSnapshot present:", Boolean(excelSnapshot));

  const runtimeContext = new RuntimeContext<{
    excelSnapshot?: ExcelContextSnapshot;
  }>();

  if (excelSnapshot) {
    runtimeContext.set("excelSnapshot", excelSnapshot);
  }

  if (!isResearchMode) {
    // Start network execution in the background for observability and agent-network semantics.
    // This does not affect the UI stream but lets Mastra run the routing agent as a network.
    (async () => {
      try {
        const networkStream = await agent.network(messages, { runtimeContext });
        for await (const event of networkStream) {
          // Temporary debug logging; adjust or remove once you wire this into richer UI/telemetry.
          // eslint-disable-next-line no-console
          console.log("[mastra-network]", event.type);
        }
      } catch {
        // Swallow network errors so they don't impact the primary chat stream.
      }
    })();
  }

  const stream = await agent.stream(messages, { runtimeContext });

  const uiMessageStream = createUIMessageStream({
    execute: async ({ writer }) => {
      const convertedStream = toAISdkFormat(stream, { from: "agent" });

      if (!convertedStream) {
        return;
      }

      const startTime = Date.now();
      let partCount = 0;
      let sawFinish = false;

      for await (const part of convertedStream) {
        // Temporary debug logging so we can see exactly what Mastra is emitting
        // eslint-disable-next-line no-console
        console.log("[mastra-chat] AI SDK part", JSON.stringify(part));
        writer.write(part);

        partCount += 1;
        if (part.type === "finish") {
          sawFinish = true;
        }

        const elapsedMs = Date.now() - startTime;
        if (!sawFinish && elapsedMs > 120_000) {
          // eslint-disable-next-line no-console
          console.warn("[api/chat] stream guard triggered", {
            mode: mode ?? "default",
            elapsedMs,
            partCount,
          });
          break;
        }
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: uiMessageStream,
  });
}
