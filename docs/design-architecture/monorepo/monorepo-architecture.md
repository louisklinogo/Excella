# Monorepo Architecture: Excella

## Overview

This document describes the current monorepo architecture for the Excella project after migrating to Bun workspaces and extracting shared logic into packages.

Key goals:
- Use **Bun workspaces** for dependency and script orchestration.
- Separate **apps** from **shared packages**.
- Centralize linting and type checking.
- Align core framework versions (Next, React, TypeScript, Biome/Ultracite).

## Repository Layout

```text
.
├─ apps/
│  └─ ai-chatbot/        # Next.js app using @ai-sdk/react and shared packages
├─ packages/
│  ├─ core/              # Shared model config, env config, and utilities
│  └─ agents/            # Mastra agents and tools
├─ docs/
│  └─ design-architecture/
│     └─ monorepo/
│        └─ monorepo-architecture.md
├─ biome.jsonc           # Ultracite/Biome config (single source of truth)
├─ package.json          # Bun workspace root
├─ bun.lock              # Single lockfile
├─ tsconfig.base.json    # Shared TS compiler options
└─ tsconfig.json         # TS solution references (apps + packages)
```

## Workspaces

Root `package.json`:

```jsonc
{
  "name": "Excella",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "next dev apps/ai-chatbot --turbopack",
    "build": "next build apps/ai-chatbot",
    "start": "next start apps/ai-chatbot",
    "lint": "bunx ultracite check",
    "format": "bunx ultracite fix"
  }
}
```

Bun maintains a single `bun.lock` at the root and installs dependencies for all workspaces.

## Shared Packages

### `@excella/core`

Purpose: shared configuration and utilities for AI models.

Location: `packages/core`.

Exports (via `package.json`):

```jsonc
"exports": {
  ".": "./src/config/model-factory.ts",
  "./env-config": "./src/config/env-config.ts",
  "./model-config": "./src/config/model-config.ts",
  "./utils": "./src/utils.ts"
}
```

Key modules:
- `config/model-config.ts`: `ModelProvider`, defaults, and provider config types.
- `config/env-config.ts`: `getEnvModelConfig()` reading `MODEL_PROVIDER`, `MODEL_ID`, provider API keys and base URLs.
- `config/model-factory.ts`: `createModel(options?: ModelFactoryOptions): LanguageModel` using `@ai-sdk/google` or `@ai-sdk/anthropic`.
- `utils.ts`: `cn(...inputs: ClassValue[]): string` (Tailwind class merge helper).

Example usage in an app:

```ts
import { createModel } from "@excella/core";
import { getEnvModelConfig } from "@excella/core/env-config";

const model = createModel();
const envConfig = getEnvModelConfig();
```

### `@excella/agents`

Purpose: shared Mastra agents and tools that encapsulate complex workflows like human-in-the-loop approval, email sending, crawling, and todo tracking.

Location: `packages/agents`.

Exports (via `package.json`):

```jsonc
"exports": {
  ".": "./src/agents/human-in-the-loop-agent.ts",
  "./human-in-the-loop-agent": "./src/agents/human-in-the-loop-agent.ts",
  "./tools/ask-for-plan-approval-tool": "./src/tools/ask-for-plan-approval-tool.ts",
  "./tools/email-tool": "./src/tools/email-tool.ts",
  "./tools/firecrawl-tool": "./src/tools/firecrawl-tool.ts",
  "./tools/propose-email-tool": "./src/tools/propose-email-tool.ts",
  "./tools/request-input": "./src/tools/request-input.ts",
  "./tools/update-todos-tool": "./src/tools/update-todos-tool.ts"
}
```

Key modules:
- `agents/human-in-the-loop-agent.ts`: `humanInTheLoopAgent` configured with Anthropic via `@ai-sdk/anthropic`, using either `ANTHROPIC_API_KEY` or a TSAI proxy.
- `tools/ask-for-plan-approval-tool.ts`: tool for plan approval around todos.
- `tools/email-tool.ts`: tool that finds a previously proposed email from model messages and sends it with Resend.
- `tools/firecrawl-tool.ts`: tool that scrapes websites either with `FIRECRAWL_API_KEY` or via TSAI Firecrawl worker.
- `tools/propose-email-tool.ts`: deterministic email draft proposal returning an `emailHandle` + `to`/`subject`/`body`.
- `tools/request-input.ts`: tool to request user input interactively.
- `tools/update-todos-tool.ts`: todo list manager that reads previous tool results from messages and applies updates.

Example integration with Mastra in an app:

```ts
import { Mastra } from "@mastra/core";
import { ConsoleLogger } from "@mastra/core/logger";
import { humanInTheLoopAgent } from "@excella/agents";

export const mastra = new Mastra({
  agents: { humanInTheLoopAgent },
  logger: new ConsoleLogger(),
});
```

## App: `@excella/ai-chatbot`

Location: `apps/ai-chatbot`.

Characteristics:
- Next.js 16 app using App Router.
- Uses `@ai-sdk/react` (`useChat`) and stubbed `ai-elements` components.
- Depends on shared packages:
  - `@excella/core` for model configuration.
  - `@excella/agents` for future agent/tool integration.

`apps/ai-chatbot/package.json` (relevant parts):

```jsonc
{
  "name": "@excella/ai-chatbot",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "bunx ultracite check apps/ai-chatbot",
    "format": "bunx ultracite fix apps/ai-chatbot"
  },
  "dependencies": {
    "@ai-sdk/react": "^2.0.76",
    "@excella/agents": "workspace:*",
    "@excella/core": "workspace:*",
    "lucide-react": "^0.546.0",
    "next": "16.0.3",
    "react": "19.2.0",
    "react-dom": "19.2.0"
  }
}
```

The chat UI uses a set of lightweight `ai-elements` stubs under `apps/ai-chatbot/src/components/ai-elements` that provide the required components (`Conversation`, `Message`, `PromptInput`, etc.) with minimal behavior while keeping the `useChat` integration intact.

## TypeScript Configuration

- `tsconfig.base.json` defines shared compiler options (strict, JSX, module resolution, etc.).
- `tsconfig.json` at root acts as a solution config with references to:
  - `apps/ai-chatbot`
  - `packages/core`
  - `packages/agents`
- Each workspace has its own `tsconfig.json` extending the base and scoping `include` to its own source tree.

This setup allows `bunx tsc --noEmit` at the root to type-check all workspaces in one pass.

## Tooling

- **Package manager / runner**: Bun workspace with single `bun.lock`.
- **Lint/format**: Ultracite + Biome (`biome.jsonc` at root).
  - `bunx ultracite check` – runs lint and style checks across the repo.
  - `bunx biome format --write <files>` – used for formatting where needed.
- **Type checking**: `bunx tsc --noEmit` from root uses the solution TS config.

## Validation Status

At the end of the migration:

- `bunx ultracite check` – passes (no lint/style errors).
- `bunx tsc --noEmit` – passes (types across apps and packages are consistent).

This confirms the Bun-workspace monorepo layout, shared packages, and app wiring are structurally sound and ready to scale with additional apps and packages.
