## Mastra + AI SDK + Next.js chat streaming issue

**Context**

- App: `apps/ai-chatbot` (Next.js 16, App Router, Bun)
- Frontend: `useChat({ api: "/api/chat" })` from `@ai-sdk/react`
- Backend: `app/api/chat/route.ts` calling Mastra `humanInTheLoopAgent`
- Mastra: `@excella/mastra` wrapper around `new Mastra({ agents: { humanInTheLoopAgent } })`

**Initial Symptoms**

- Browser console / AI SDK: `TypeError: Failed to fetch` from `DefaultChatTransport.sendMessages`.
- Next dev server: 500 errors when hitting `/api/chat`.
- After fixes, `/api/chat` returns 200 but **no assistant response appears in the UI**.

**Root Causes Identified**

1. **Wrong API shape when using `MastraClient` in the Next route**
   - Used client SDK style incorrectly:
     - Called `agent.stream(mastraMessages, { format: "aisdk" })`.
     - Mastra Client docs expect `agent.stream({ messages: [...] })`.
   - This mismatch led to runtime errors and `Failed to fetch` on the AI SDK side.

2. **Over-complicated streaming via `MastraClient` instead of the local `mastra` instance**
   - The route originally did: `Next API route -> mastraClient -> Mastra server` and then manually built an SSE `ReadableStream`.
   - Mastra + AI SDK docs instead recommend either:
     - Calling `mastra.getAgent().stream(messages, { format: "aisdk" }).toUIMessageStreamResponse()`, or
     - Using `@mastra/ai-sdk` helpers (`chatRoute`, `toAISdkFormat`).

3. **Deprecation of `format: "aisdk"`**
   - Mastra warns that `{ format: "aisdk" }` is deprecated and recommends using the `@mastra/ai-sdk` package:
     - `toAISdkFormat(stream, { from: "agent" })` + AI SDK `createUIMessageStream`.

4. **UI only renders `part.type === "text"`**
   - `app/page.tsx` looks for:

     ```ts
     const textPart = message.parts.find((part) => part.type === "text");
     ```

     and only renders when a `text` part exists.

   - The Mastra + `toAISdkFormat` stream actually emits **delta-style events**:

     ```json
     {"type":"text-start","id":"0"}
     {"type":"text-delta","id":"0","delta":"Hello"}
     {"type":"text-delta","id":"0","delta":"! How can I help you today?"}
     {"type":"text-end","id":"0"}
     ```

   - There is **no final `type: "text"` part**, so the UI treats responses as empty even though the stream is working.

5. **Telemetry warnings and instrumentation**
   - Mastra telemetry warning: requires `globalThis.___MASTRA_TELEMETRY___ = true` set in an instrumentation file.
   - Next.js already had an `apps/ai-chatbot/instrumentation.ts` for `@vercel/otel`, and we accidentally added a second one at `apps/ai-chatbot/src/instrumentation.ts`.
   - Needed to consolidate to a single root-level instrumentation file.

**Solutions Implemented (High-Level)**

1. **Switch `/api/chat` to use `mastra` instance and `@mastra/ai-sdk`**

   - New route implementation:

   ```ts
   // apps/ai-chatbot/src/app/api/chat/route.ts
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
     const agent = mastra.getAgent("humanInTheLoopAgent");

     const stream = await agent.stream(messages);

     const uiMessageStream = createUIMessageStream({
       execute: async ({ writer }) => {
         // Debug logging to understand emitted parts
         const textBuffers = new Map<string, string>();

         for await (const part of toAISdkFormat(stream, { from: "agent" })!) {
           // eslint-disable-next-line no-console
           console.log("[mastra-chat] AI SDK part", JSON.stringify(part));

           // Accumulate text by id
           if (part.type === "text-start" && part.id != null) {
             textBuffers.set(part.id, "");
           } else if (part.type === "text-delta" && part.id != null) {
             const prev = textBuffers.get(part.id) ?? "";
             textBuffers.set(part.id, prev + part.delta);
           } else if (part.type === "text-end" && part.id != null) {
             const fullText = textBuffers.get(part.id) ?? "";
             textBuffers.delete(part.id);

             // Synthesize a `text` part compatible with existing UI
             writer.write({
               type: "text",
               text: fullText,
             } as any);
           }

           // Forward original part for future richer UI usage
           writer.write(part);
         }
       },
     });

     return createUIMessageStreamResponse({
       stream: uiMessageStream,
     });
   }
   ```

   - This:
     - Uses Mastra server-side agent directly (`mastra.getAgent`).
     - Uses `toAISdkFormat` (preferred over `format: "aisdk"`).
     - Accumulates `text-delta` chunks into a synthetic `type: "text"` part on `text-end` so that the existing React UI (which expects `part.type === "text"`) can render responses.

2. **Package installs**

   - Installed required packages per warnings and docs:

   ```bash
   bun add prettier @mastra/ai-sdk
   ```

   - `prettier` resolves `@react-email/render` externalization warnings.
   - `@mastra/ai-sdk` is used for `toAISdkFormat` and AI SDK streaming helpers.

3. **Instrumentation file consolidation for telemetry**

   - Kept a single Next.js instrumentation entrypoint at the app root:

   ```ts
   // apps/ai-chatbot/instrumentation.ts
   import { registerOTel } from "@vercel/otel";

   export function register() {
     registerOTel({ serviceName: "ai-chatbot" });
     (globalThis as unknown as { ___MASTRA_TELEMETRY___?: boolean }).___MASTRA_TELEMETRY___ = true;
   }
   ```

   - Deleted the extra `apps/ai-chatbot/src/instrumentation.ts`.
   - This satisfies Mastra's instruction to set `globalThis.___MASTRA_TELEMETRY___ = true` while preserving existing Vercel OTEL setup.

**Open Follow-Ups / Future Cleanup**

- UI currently uses a synthetic `text` part shim:
  - Long-term, consider updating the React components in `app/page.tsx` to handle AI SDK v5 events more natively (`text-delta`, `data-*` parts) and remove the synthetic `text` wrapper.

- Tool-related parts (`tool-input-*`, `tool-output-available`) are currently ignored in the UI:
  - The logs show active usage of `updateTodosTool` and possibly other tools.
  - Future work: add dedicated UI views for these `data-*` / tool parts, following patterns from `@mastra/ai-sdk` docs.

- Telemetry deprecation:
  - Mastra telemetry will be removed in favor of AI Tracing.
  - Future refactor: adopt AI Tracing per https://mastra.ai/en/docs/observability/ai-tracing/overview.
