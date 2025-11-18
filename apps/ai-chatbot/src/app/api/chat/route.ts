import type { UIMessage } from "ai";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { mastra } from "@excella/mastra";
import { toAISdkFormat } from "@mastra/ai-sdk";

export const maxDuration = 30;

type ChatRequestBody = {
  messages: UIMessage[];
};

export async function POST(request: Request): Promise<Response> {
  const { messages } = (await request.json()) as ChatRequestBody;
  const agent = mastra.getAgent("routingAgent");
  // Start network execution in the background for observability and agent-network semantics.
  // This does not affect the UI stream but lets Mastra run the routing agent as a network.
  (async () => {
    try {
      const networkStream = await agent.network(messages);
      for await (const event of networkStream) {
        // Temporary debug logging; adjust or remove once you wire this into richer UI/telemetry.
        // eslint-disable-next-line no-console
        console.log("[mastra-network]", event.type);
      }
    } catch {
      // Swallow network errors so they don't impact the primary chat stream.
    }
  })();

  const stream = await agent.stream(messages);

  const uiMessageStream = createUIMessageStream({
    execute: async ({ writer }) => {
      for await (const part of toAISdkFormat(stream, { from: "agent" })!) {
        // Temporary debug logging so we can see exactly what Mastra is emitting
        // eslint-disable-next-line no-console
        console.log("[mastra-chat] AI SDK part", JSON.stringify(part));
        writer.write(part);
      }
    },
  });

  return createUIMessageStreamResponse({
    stream: uiMessageStream,
  });
}
