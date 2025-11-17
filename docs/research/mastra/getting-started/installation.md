# Install Mastra | Getting Started

Guide on installing Mastra and setting up the necessary prerequisites for running it with various LLM providers.

Source: https://mastra.ai/docs/getting-started/installation

---

# Install Mastra

The `create mastra`CLI command is the quickest way to start a new Mastra project. It walks you through setup and creates example agents, workflows, and tools for you to learn from or adapt. 

For more control over setup, or to add Mastra to an existing project, see the [manual installation guide](#install-manually). You can also use [mastra init](/reference/cli/mastra#mastra-init)for existing projects. 

## Before you start​

- You'll need an API key from a model provider to complete setup. We suggest starting with OpenAI, but if you need a provider that doesn't require a credit card, Google's Gemini is also an option.
- Install Node.js 20 or later.

## Install with create mastra​

You can run `create mastra`anywhere on your machine. 

The wizard will guide you through setup, create a new directory for your project, and generate a weather agent with example workflows and tools to get you started. 

- npm
- pnpm
- yarn
- bun

```
npm create mastra@latest
```

```
pnpm create mastra@latest
```

```
yarn create mastra@latest
```

```
bun create mastra@latest
```

note You can use flags with `create mastra`like `--no-example`to skip the example weather agent or `--template`to start from a specific [template](/docs/getting-started/templates). Read the [CLI reference](/reference/cli/create-mastra)for all options. 

### Test your agent​

Once setup is complete, follow the instructions in your terminal to start the Mastra dev server, then open Studio at [http://localhost:4111](http://localhost:4111). 

Try asking about the weather. If your API key is set up correctly, you'll get a response: 

Your browser does not support the video tag. note If you encounter an error, your API key may not be configured correctly. Double-check your setup and try again. Need more help? [Join our Discord](https://discord.gg/BTYqqHKUrf)and talk to the team directly. 

[Studio](/docs/getting-started/studio)lets you rapidly build and prototype agents without needing to build a UI. Once you're ready, you can integrate your Mastra agent into your application using the guides below. 

### Next steps​

- Read more about Mastra's features.
- Integrate Mastra with your frontend framework: Next.js, React, or Astro.
- Build an agent from scratch following one of our guides.
- Watch conceptual guides on our YouTube channel and subscribe!

## Install manually​

If you prefer not to use our automatic `create mastra`CLI tool, you can set up your project yourself by following the guide below. 

1. Create a new project and change directory:mkdir my-first-agent && cd my-first-agentInitialize a TypeScript project and install the following dependencies:npmpnpmyarnbunnpm init -ynpm install -D typescript @types/node mastra@latestnpm install @mastra/core@latest zod@^4pnpm init -ypnpm add -D typescript @types/node mastra@latestpnpm add @mastra/core@latest zod@^4yarn init -yyarn add -D typescript @types/node mastra@latestyarn add @mastra/core@latest zod@^4bun init -ybun add -d typescript @types/node mastra@latestbun add @mastra/core@latest zod@^4Add dev and build scripts to your package.json file:package.json{  "scripts": {    "test": "echo \"Error: no test specified\" && exit 1",    "dev": "mastra dev",    "build": "mastra build"  }}
2. Create a tsconfig.json file:touch tsconfig.jsonAdd the following configuration:tsconfig.json{  "compilerOptions": {    "target": "ES2022",    "module": "ES2022",    "moduleResolution": "bundler",    "esModuleInterop": true,    "forceConsistentCasingInFileNames": true,    "strict": true,    "skipLibCheck": true,    "noEmit": true,    "outDir": "dist"  },  "include": ["src/**/*"]}infoMastra requires modern module and moduleResolution settings. Using CommonJS or node will cause resolution errors.
3. Create an .env file:touch .envAdd your API key:.envGOOGLE_GENERATIVE_AI_API_KEY=<your-api-key>noteThis guide uses Google Gemini, but you can use any supported model provider, including OpenAI, Anthropic, and more.
4. Create a weather-tool.ts file:mkdir -p src/mastra/tools && touch src/mastra/tools/weather-tool.tsAdd the following code:src/mastra/tools/weather-tool.tsimport { createTool } from "@mastra/core/tools";import { z } from "zod";export const weatherTool = createTool({  id: "get-weather",  description: "Get current weather for a location",  inputSchema: z.object({    location: z.string().describe("City name"),  }),  outputSchema: z.object({    output: z.string(),  }),  execute: async () => {    return {      output: "The weather is sunny",    };  },});infoWe've shortened and simplified the weatherTool example here. You can see the complete weather tool under Giving an Agent a Tool.
5. Create a weather-agent.ts file:mkdir -p src/mastra/agents && touch src/mastra/agents/weather-agent.tsAdd the following code:src/mastra/agents/weather-agent.tsimport { Agent } from "@mastra/core/agent";import { weatherTool } from "../tools/weather-tool";export const weatherAgent = new Agent({  name: "Weather Agent",  instructions: `      You are a helpful weather assistant that provides accurate weather information.      Your primary function is to help users get weather details for specific locations. When responding:      - Always ask for a location if none is provided      - If the location name isn't in English, please translate it      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")      - Include relevant details like humidity, wind conditions, and precipitation      - Keep responses concise but informative      Use the weatherTool to fetch current weather data.`,  model: "google/gemini-2.5-pro",  tools: { weatherTool },});
6. Create the Mastra entry point and register your agent:touch src/mastra/index.tsAdd the following code:src/mastra/index.tsimport { Mastra } from "@mastra/core/mastra";import { weatherAgent } from "./agents/weather-agent";export const mastra = new Mastra({  agents: { weatherAgent },});
7. You can now launch Studio and test your agent.npmpnpmyarnbunnpm run devpnpm run devyarn run devbun run dev