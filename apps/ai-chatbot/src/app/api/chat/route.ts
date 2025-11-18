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
  const agent = mastra.getAgent("chatAgent");

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
