# Project Structure | Getting Started

Guide on organizing folders and files in Mastra, including best practices and recommended structures.

Source: https://mastra.ai/docs/getting-started/project-structure

---

# Project Structure

Your new Mastra project, created with the `create mastra`command, comes with a predefined set of files and folders to help you get started. 

Mastra is a framework, but it's **unopinionated**about how you organize or colocate your files. The CLI provides a sensible default structure that works well for most projects, but you're free to adapt it to your workflow or team conventions. You could even build your entire project in a single file if you wanted! Whatever structure you choose, keep it consistent to ensure your code stays maintainable and easy to navigate. 

## Default project structure​

A project created with the `create mastra`command looks like this: 

```
src/├── mastra/│   ├── agents/│   │   └── weather-agent.ts│   ├── tools/│   │   └── weather-tool.ts│   ├── workflows/│   │   └── weather-workflow.ts│   ├── scorers/│   │   └── weather-scorer.ts│   └── index.ts├── .env.example├── package.json└── tsconfig.json
```

info Tip - Use the predefined files as templates. Duplicate and adapt them to quickly create your own agents, tools, workflows, etc. 

### Folders​

Folders organize your agent's resources, like agents, tools, and workflows. 

FolderDescriptionsrc/mastraEntry point for all Mastra-related code and configuration.src/mastra/agentsDefine and configure your agents - their behavior, goals, and tools.src/mastra/workflowsDefine multi-step workflows that orchestrate agents and tools together.src/mastra/toolsCreate reusable tools that your agents can callsrc/mastra/mcp(Optional) Implement custom MCP servers to share your tools with external agentssrc/mastra/scorers(Optional) Define scorers for evaluating agent performance over timesrc/mastra/public(Optional) Contents are copied into the .build/output directory during the build process, making them available for serving at runtime

### Top-level files​

Top-level files define how your Mastra project is configured, built, and connected to its environment. 

FileDescriptionsrc/mastra/index.tsCentral entry point where you configure and initialize Mastra..env.exampleTemplate for environment variables - copy and rename to .env to add your secret model provider keys.package.jsonDefines project metadata, dependencies, and available npm scripts.tsconfig.jsonConfigures TypeScript options such as path aliases, compiler settings, and build output.

## Next steps​

- Read more about Mastra's features.
- Integrate Mastra with your frontend framework: Next.js, React, or Astro.
- Build an agent from scratch following one of our guides.
- Watch conceptual guides on our YouTube channel and subscribe!