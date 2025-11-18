import type { ExcelContextSnapshot } from "@excella/core/excel/context-snapshot";
import { mastra } from "@excella/mastra";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { RuntimeContext } from "@mastra/core/runtime-context";
import { createUIMessageStreamResponse } from "ai";

import { createMastraUIMessageStream } from "@/lib/chat-stream";

export const maxDuration = 30;

type ChatRequestBody = {
  messages: import("@/lib/chat-stream").ChatRequestBody["messages"];
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
