# Mastra Client SDK | Server & DB

Learn how to set up and use the Mastra Client SDK

Source: https://mastra.ai/docs/server-db/mastra-client

---

# Mastra Client SDK

The Mastra Client SDK provides a simple and type-safe interface for interacting with your [Mastra Server](/docs/server-db/mastra-server)from your client environment. 

## Prerequisites​

To ensure smooth local development, make sure you have: 

- Node.js v18 or higher
- TypeScript v4.7 or higher (if using TypeScript)
- Your local Mastra server running (typically on port 4111)

## Usage​

The Mastra Client SDK is designed for browser environments and uses the native `fetch`API for making HTTP requests to your Mastra server. 

## Installation​

To use the Mastra Client SDK, install the required dependencies: 

- npm
- pnpm
- yarn
- bun

```
npm install @mastra/client-js@latest
```

```
pnpm add @mastra/client-js@latest
```

```
yarn add @mastra/client-js@latest
```

```
bun add @mastra/client-js@latest
```

### Initialize the MastraClient​

Once initialized with a `baseUrl`, `MastraClient`exposes a type-safe interface for calling agents, tools, and workflows. 

lib/mastra-client.ts 
```
import { MastraClient } from "@mastra/client-js";export const mastraClient = new MastraClient({  baseUrl: process.env.MASTRA_API_URL || "http://localhost:4111",});
```

## Core APIs​

The Mastra Client SDK exposes all resources served by the Mastra Server 

- Agents: Generate responses and stream conversations.
- Memory: Manage conversation threads and message history.
- Tools: Executed and managed tools.
- Workflows: Trigger workflows and track their execution.
- Vectors: Use vector embeddings for semantic search.
- Logs: View logs and debug system behavior.
- Telemetry: Monitor app performance and trace activity.

## Generating responses​

Call `.generate()`with an array of message objects that include `role`and `content`: 

```
import { mastraClient } from "lib/mastra-client";const testAgent = async () => {  try {    const agent = mastraClient.getAgent("testAgent");    const response = await agent.generate({      messages: [        {          role: "user",          content: "Hello",        },      ],    });    console.log(response.text);  } catch (error) {    return "Error occurred while generating response";  }};
```

> See .generate() for more information.

## Streaming responses​

Use `.stream()`for real-time responses with an array of message objects that include `role`and `content`: 

```
import { mastraClient } from "lib/mastra-client";const testAgent = async () => {  try {    const agent = mastraClient.getAgent("testAgent");    const stream = await agent.stream({      messages: [        {          role: "user",          content: "Hello",        },      ],    });    stream.processDataStream({      onTextPart: (text) => {        console.log(text);      },    });  } catch (error) {    return "Error occurred while generating response";  }};
```

> See .stream() for more information.

## Configuration options​

`MastraClient`accepts optional parameters like `retries`, `backoffMs`, and `headers`to control request behavior. These parameters are useful for controlling retry behavior and including diagnostic metadata. 

lib/mastra-client.ts 
```
import { MastraClient } from "@mastra/client-js";export const mastraClient = new MastraClient({  // ...  retries: 3,  backoffMs: 300,  maxBackoffMs: 5000,  headers: {    "X-Development": "true",  },});
```

> See MastraClient for more configuration options.

## Adding request cancelling​

`MastraClient`supports request cancellation using the standard Node.js `AbortSignal`API. Useful for canceling in-flight requests, such as when users abort an operation or to clean up stale network calls. 

Pass an `AbortSignal`to the client constructor to enable cancellation across all requests. 

lib/mastra-client.ts 
```
import { MastraClient } from "@mastra/client-js";export const controller = new AbortController();export const mastraClient = new MastraClient({  baseUrl: process.env.MASTRA_API_URL || "http://localhost:4111",  abortSignal: controller.signal,});
```

### Using the AbortController​

Calling `.abort()`will cancel any ongoing requests tied to that signal. 

```
import { mastraClient, controller } from "lib/mastra-client";const handleAbort = () => {  controller.abort();};
```

## Client tools​

Define tools directly in client-side applications using the `createTool()`function. Pass them to agents via the `clientTools`parameter in `.generate()`or `.stream()`calls. 

This lets agents trigger browser-side functionality such as DOM manipulation, local storage access, or other Web APIs, enabling tool execution in the user's environment rather than on the server. 

```
import { createTool } from "@mastra/client-js";import { z } from "zod";const handleClientTool = async () => {  try {    const agent = mastraClient.getAgent("colorAgent");    const colorChangeTool = createTool({      id: "color-change-tool",      description: "Changes the HTML background color",      inputSchema: z.object({        color: z.string(),      }),      outputSchema: z.object({        success: z.boolean(),      }),      execute: async ({ context }) => {        const { color } = context;        document.body.style.backgroundColor = color;        return { success: true };      },    });    const response = await agent.generate({      messages: "Change the background to blue",      clientTools: { colorChangeTool },    });    console.log(response);  } catch (error) {    console.error(error);  }};
```

### Client tool's agent​

This is a standard Mastra [agent](/docs/agents/overview#setting-up-agents)configured to return hex color codes, intended to work with the browser-based client tool defined above. 

src/mastra/agents/color-agent 
```
import { openai } from "@ai-sdk/openai";import { Agent } from "@mastra/core/agent";export const colorAgent = new Agent({  name: "test-agent",  instructions: `You are a helpful CSS assistant.  You can change the background color of web pages.  Respond with a hex reference for the color requested by the user`,  model: openai("gpt-4o-mini"),});
```

## Server-side environments​

You can also use `MastraClient`in server-side environments such as API routes, serverless functions or actions. The usage will broadly remain the same but you may need to recreate the response to your client: 

```
export async function action() {  const agent = mastraClient.getAgent("testAgent");  const stream = await agent.stream({    messages: [{ role: "user", content: "Hello" }],  });  return new Response(stream.body);}
```

## Best practices​

2. Error Handling: Implement proper error handling for development scenarios.
4. Environment Variables: Use environment variables for configuration.
6. Debugging: Enable detailed logging when needed.
8. Performance: Monitor application performance, telemetry and traces.