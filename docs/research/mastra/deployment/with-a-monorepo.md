# Monorepo Deployment | Deployment

Learn how to deploy Mastra applications that are part of a monorepo setup

Source: https://mastra.ai/docs/deployment/monorepo

---

# Monorepo Deployment

Deploying Mastra in a monorepo follows the same approach as deploying a standalone application. While some [Cloud](/docs/deployment/cloud-providers/)or [Serverless Platform](/docs/deployment/cloud-providers/)providers may introduce extra requirements, the core setup is the same. 

## Example monorepo​

In this example, the Mastra application is located at `apps/api`. 

```
apps/├── api/│   ├── src/│   │   └── mastra/│   │       ├── agents/│   │       ├── tools/│   │       ├── workflows/│   │       └── index.ts│   ├── package.json│   └── tsconfig.json└── web/packages/├── ui/└── utils/package.json
```

## Environment variables​

Environment variables like `OPENAI_API_KEY`should be stored in an `.env`file at the root of the Mastra application `(apps/api)`, for example: 

```
api/├── src/│   └── mastra/├── .env├── package.json└── tsconfig.json
```

## Deployment configuration​

The image below shows how to select `apps/api`as the project root when deploying to [Mastra Cloud](/docs/deployment/mastra-cloud/overview). While the interface may differ between providers, the configuration remains the same. 

## Dependency management​

In a monorepo, keep dependencies consistent to avoid version conflicts and build errors. 

- Use a single lockfile at the project root so all packages resolve the same versions.
- Align versions of shared libraries (like Mastra or frameworks) to prevent duplicates.

## Deployment pitfalls​

Common issues to watch for when deploying Mastra in a monorepo: 

- Wrong project root: make sure the correct package (e.g. apps/api) is selected as the deploy target.

## Bundler options​

Use `transpilePackages`to compile TypeScript workspace packages or libraries. List package names exactly as they appear in each `package.json`. Use `externals`to exclude dependencies resolved at runtime, and `sourcemap`to emit readable stack traces. 

src/mastra/index.ts 
```
import { Mastra } from "@mastra/core/mastra";export const mastra = new Mastra({  // ...  bundler: {    transpilePackages: ["utils"],    externals: ["ui"],    sourcemap: true,  },});
```

> See Mastra Class for more configuration options.

## Supported monorepos​

Mastra works with: 

- npm workspaces
- pnpm workspaces
- Yarn workspaces
- Turborepo

Known limitations: 

- Bun workspaces — partial support; known issues
- Nx — You can use Nx's supported dependency strategies but you need to have package.json files inside your workspace packages

> If you are experiencing issues with monorepos see our: Monorepos Support mega issue.