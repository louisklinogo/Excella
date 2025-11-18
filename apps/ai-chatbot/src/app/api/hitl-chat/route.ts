import { mastra } from "@excella/mastra";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

export const maxDuration = 30;

type HitlChatRequestBody = {
  messages: UIMessage[];
};

export async function POST(request: Request): Promise<Response> {
  const { messages } = (await request.json()) as HitlChatRequestBody;

  const agent = mastra.getAgent("humanInTheLoopAgent");

  const stream = await agent.stream(convertToModelMessages(messages), {
    format: "aisdk",
    maxSteps: 10,
    modelSettings: {},
    onError: ({ error }: { error: unknown }) => {
      // eslint-disable-next-line no-console
      console.error("Mastra HITL stream onError", error);
    },
  });

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.merge(
          stream.toUIMessageStream().pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                if (
                  chunk.type === "start" &&
                  messages[messages.length - 1]?.role === "assistant"
                ) {
                  controller.enqueue({
                    ...chunk,
                    messageId: messages[messages.length - 1]!.id,
                  });
                } else {
                  controller.enqueue(chunk);
                }
              },
            })
          )
        );
      },
    }),
  });
}
