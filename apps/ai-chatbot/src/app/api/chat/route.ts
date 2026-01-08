import type { ExcelContextSnapshot } from "@excella/core/excel/context-snapshot";
import { mastra } from "@excella/mastra";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { createUIMessageStreamResponse } from "ai";

import type { ChatRequestBody as StreamChatRequestBody } from "@/lib/chat-stream";
import { createMastraUIMessageStream } from "@/lib/chat-stream";

export const maxDuration = 30;

type ChatRequestBody = {
  messages: StreamChatRequestBody["messages"];
  excelSnapshot?: ExcelContextSnapshot | null;
  mode?: "default" | "research";
};

export async function POST(request: Request): Promise<Response> {
  const { messages, excelSnapshot, mode } =
    (await request.json()) as ChatRequestBody;

  const agent = mastra.getAgent("routingAgent");

  // eslint-disable-next-line no-console
  console.log("[api/chat] excelSnapshot present:", Boolean(excelSnapshot));

  const runtimeContext = new RuntimeContext<{
    excelSnapshot?: ExcelContextSnapshot;
  }>();

  if (excelSnapshot) {
    runtimeContext.set("excelSnapshot", excelSnapshot);
  }

  const preferResearch = mode === "research";

  const systemResearchMessage: StreamChatRequestBody["messages"][number] | null =
    preferResearch
      ? {
          id: "excella-research-mode",
          role: "system",
          content:
            "The user has explicitly enabled research mode in the UI. For this turn, treat their request as primarily a web and document research query and aggressively use your research tools and researchAgent when deciding how to respond.",
        }
      : null;

  const routedMessages = systemResearchMessage
    ? [systemResearchMessage, ...messages]
    : messages;

  // Start network execution in the background for observability and agent-network semantics.
  // This does not affect the UI stream but lets Mastra run the routing agent as a network.
  (async () => {
    try {
      const networkStream = await agent.network(routedMessages, {
        runtimeContext,
        abortSignal: request.signal,
      });
      for await (const event of networkStream) {
        // Temporary debug logging; adjust or remove once you wire this into richer UI/telemetry.
        // eslint-disable-next-line no-console
        console.log("[mastra-network]", event.type);
      }
    } catch {
      // Swallow network errors so they don't impact the primary chat stream.
    }
  })();

  const stream = await agent.stream(routedMessages, {
    runtimeContext,
    abortSignal: request.signal,
  });

  const convertedStream = toAISdkFormat(stream, { from: "agent" });

  if (!convertedStream) {
    return createUIMessageStreamResponse({
      stream: createMastraUIMessageStream({
        // Empty stream; this should rarely happen but keeps types happy.
        stream: (async function* () {})(),
        mode,
      }),
    });
  }

  const uiMessageStream = createMastraUIMessageStream({
    stream: convertedStream,
    mode,
  });

  return createUIMessageStreamResponse({
    stream: uiMessageStream,
  });
}
