# Mastra Ecosystem: Deep Research Report

**Date:** November 12, 2025  
**Purpose:** Understanding Mastra architecture for Excella rebuild

Based on comprehensive research, here's what you need to know about Mastra and how it differs from AI SDK's approach:

---

## 1. Core Architecture Philosophy

### Mastra ≠ AI SDK Replacement
- Mastra is **built ON TOP of AI SDK** (uses Vercel AI SDK v4 & v5 for model routing)
- It's a **framework layer** that adds agent orchestration, workflows, memory, and production tooling
- Think: AI SDK provides LLM primitives, Mastra provides agent systems

### Key Design Principle:
```
Functional Core, Imperative Shell
- Agents/tools are DATA (pure objects)
- Business logic lives in PURE FUNCTIONS (handlers)
- No class inheritance hell like LangChain
```

---

## 2. Agent System (vs AI SDK)

### AI SDK Agents (Your Problem):
- Unstable multi-agent orchestration
- Tool calling issues
- State management problems

### Mastra Agents (Solution):

```typescript
const agent = new Agent({
  name: "excel-agent",
  instructions: "You handle Excel operations...",
  model: openai("gpt-4o"),
  tools: { readTool, writeTool, formatTool },
  agents: { subAgent1, subAgent2 }, // Can call other agents!
});
```

### Key Features:
- **Memory built-in** (conversation history, semantic search)
- **Multi-step execution** with `maxSteps` parameter
- **Tool execution** with automatic retries
- **Sub-agents** (agents can call other agents as tools)
- **Runtime context** for dynamic behavior

---

## 3. Multi-Agent Patterns

Mastra supports 3 multi-agent architectures:

### A) Sequential Multi-Agent (Workflows)
```typescript
const workflow = createWorkflow({ /* ... */ })
  .step(researchAgent)    // Agent 1
  .then(writerAgent)      // Agent 2 gets output from Agent 1
  .then(editorAgent)      // Agent 3 refines
  .commit();
```

### B) Hierarchical Multi-Agent (Supervisor Pattern)
```typescript
const supervisorAgent = new Agent({
  name: "supervisor",
  agents: { 
    copywriterAgent,  // Specialist agent 1
    editorAgent       // Specialist agent 2
  },
  // Supervisor decides which agent to call and when
});
```

### C) Agent Network (Dynamic Orchestration)
```typescript
const network = new AgentNetwork({
  agents: { agent1, agent2, agent3 },
  workflows: { workflow1, workflow2 },
  tools: { tool1, tool2 },
  // LLM dynamically decides what to call based on context
});
```

**For Excella**: Use **Hierarchical + Workflows** pattern
- Orchestrator agent (triage/planning)
- Specialist subagents (Excel.Read, Excel.Write, Excel.Format, etc.)
- Workflows for deterministic Excel operation sequences

---

## 4. Tool System

### Creating Tools (Pure Functions):
```typescript
export const excelReadTool = createTool({
  id: "excel-read",
  description: "Read data from Excel range",
  inputSchema: z.object({
    range: z.string(),
    sheet: z.string().optional(),
  }),
  outputSchema: z.object({
    data: z.array(z.array(z.any())),
  }),
  execute: async ({ context }) => {
    // Pure business logic here
    const { range, sheet } = context;
    return { data: readFromExcel(range, sheet) };
  },
});
```

### Key Points:
- Tools are **data containers** (no class inheritance)
- `execute` is a **pure function** (testable in isolation)
- Zod schemas for **type safety**
- Tools can be used in agents OR workflows

---

## 5. Workflow System (Game Changer)

**Problem Solved**: Deterministic operations mixed with agentic ones

```typescript
const excelWorkflow = createWorkflow({
  id: "excel-analysis",
  inputSchema: z.object({ /* ... */ }),
  outputSchema: z.object({ /* ... */ }),
})
  // Deterministic steps
  .step(validateInput)
  .then(readData)
  
  // Parallel execution
  .parallel([calculateStats, generateChart])
  
  // Conditional branching
  .branch([
    [({ context }) => context.needsFormatting, formatStep],
    [({ context }) => context.needsValidation, validateStep],
  ])
  
  // Agent decision-making
  .then(analysisAgent)  // Agent analyzes and decides next steps
  
  // Human-in-the-loop
  .suspend()  // Pause for approval
  .resume()   // Continue after approval
  
  .commit();
```

### Control Flow Options:
- **Sequential**: `.then()`
- **Parallel**: `.parallel([...])` or `.step(a).step(b)` (concurrent)
- **Conditional**: `.branch([[condition, step], ...])`
- **Loops**: `.doWhile()`, `.doUntil()`, `.foreach()`
- **Subscribed**: `.after(stepId)` (event-driven)
- **Human-in-loop**: `.suspend()` / `.resume()`

---

## 6. Memory System

### Built-in Context Management:
```typescript
await agent.generate("message", {
  memory: {
    thread: "conversation-123",
    resource: "user-456",
  },
  memoryOptions: {
    lastMessages: 10,           // Recent context
    semanticRecall: {
      topK: 3,                 // Semantic search
      messageRange: 5,         // Context window
    },
  },
});
```

### Storage Backends:
- In-memory (dev)
- Redis/Upstash (production)
- LibSQL (local dev environment)
- Custom storage adapters

---

## 7. Key Differences from AI SDK

| Feature | AI SDK | Mastra |
|---------|--------|--------|
| **Agent Architecture** | Unstable, class-based | Stable, functional |
| **Multi-Agent** | Limited support | Built-in (3 patterns) |
| **Workflows** | None | Full graph-based engine |
| **Memory** | Manual implementation | Built-in with search |
| **Tool Calling** | Basic | Advanced with retries |
| **Human-in-Loop** | Manual | Built-in suspend/resume |
| **Observability** | Manual | Built-in OpenTelemetry |
| **Dev Environment** | None | Mastra Studio (GUI) |

---

## 8. Excella Migration Strategy

### Old Excella (AI SDK):
```
User → Triage Agent → Orchestrator → [Excel Subagents]
         ❌ Unstable orchestration
         ❌ Tool calling issues
         ❌ State management problems
```

### New Excella (Mastra):
```typescript
// 1. Define Excel subagents
const excelReadAgent = new Agent({
  name: "excel-read",
  instructions: "Read Excel data...",
  tools: { readRange, readSelection, ... },
});

// 2. Create orchestrator with subagents
const orchestratorAgent = new Agent({
  name: "orchestrator",
  instructions: "Plan and execute Excel tasks...",
  agents: { 
    excelRead: excelReadAgent,
    excelWrite: excelWriteAgent,
    excelFormat: excelFormatAgent,
  },
  tools: { planningTool, budgetTool },
});

// 3. Wrap in workflow for deterministic steps
const excelTaskWorkflow = createWorkflow({/* ... */})
  .step(validateContext)        // Deterministic
  .then(orchestratorAgent)      // Agentic planning
  .suspend()                    // Human approval
  .resume()
  .parallel([                   // Execute approved tasks
    excelReadAgent,
    excelFormatAgent
  ])
  .commit();
```

---

## 9. Why Mastra > AI SDK for Excella

✅ **Stable Multi-Agent**: Proven orchestration patterns  
✅ **Workflow + Agents**: Mix deterministic + agentic  
✅ **Built-in Approval**: `suspend()/resume()` perfect for Excel  
✅ **Memory System**: Track workbook state, user context  
✅ **Tool System**: Pure functions = testable Excel operations  
✅ **Dev Studio**: Visual debugging of agent execution  
✅ **Production Ready**: Evals, observability, logging built-in

---

## 10. Next Steps for Excella Rebuild

1. **Port Excel Tools** → Mastra `createTool()` format
2. **Define Subagents** → Excel.Read, Excel.Write, Excel.Format, etc.
3. **Build Orchestrator** → Hierarchical agent with subagents
4. **Create Workflows** → For deterministic Excel operation sequences
5. **Add Approval Gates** → `suspend()/resume()` for write operations
6. **Integrate Memory** → Track workbook profile, user preferences
7. **Build UI** → Use assistant-ui (already in template!) for tool rendering

---

## 🎯 TL;DR for Your Use Case

### Problem
AI SDK's agent system was unstable for multi-agent orchestration

### Solution
Mastra provides:
- Stable multi-agent patterns (sequential, hierarchical, network)
- Workflows for mixing deterministic + agentic logic
- Built-in approval gates (perfect for Excel operations)
- Functional architecture (no class inheritance hell)
- Production tooling (memory, evals, observability)

### Architecture for New Excella:
```
Orchestrator Agent (planning)
  ├── Excel.Read Agent (subagent)
  ├── Excel.Write Agent (subagent)  
  ├── Excel.Format Agent (subagent)
  └── Web.Research Agent (subagent)

Wrapped in Workflow:
  1. Validate → 2. Plan (agent) → 3. Approve (human) → 4. Execute (parallel agents)
```

---

## Resources

- **Mastra Docs**: https://mastra.ai/docs
- **GitHub**: https://github.com/mastra-ai/mastra
- **Discord**: https://discord.gg/ZvGZ9DGfqn
- **AI SDK v5 Support**: Mastra handles both v4 & v5 streams
- **Templates**: https://mastra.ai/templates

---

**Conclusion**: You were 100% right to switch from AI SDK to Mastra. The template you forked already has Mastra + assistant-ui, which is the perfect foundation for rebuilding Excella!
