# Guardrails | Agents

Learn how to implement guardrails using input and output processors to secure and control AI interactions.

Source: https://mastra.ai/docs/agents/guardrails

---

# Guardrails

Agents use processors to apply guardrails to inputs and outputs. They run before or after each interaction, giving you a way to review, transform, or block information as it passes between the user and the agent. 

Processors can be configured as: 

- inputProcessors: Applied before messages reach the language model.
- outputProcessors: Applied to responses before they're returned to users.

Some processors are *hybrid*, meaning they can be used with either `inputProcessors`or `outputProcessors`, depending on where the logic should be applied. 

## When to use processors​

Use processors for content moderation, prompt injection prevention, response sanitization, message transformation, and other security-related controls. Mastra provides several built-in input and output processors for common use cases. 

## Adding processors to an agent​

Import and instantiate the relevant processor class, and pass it to your agent’s configuration using either the `inputProcessors`or `outputProcessors`option: 

src/mastra/agents/moderated-agent.ts 
```
import { openai } from "@ai-sdk/openai";import { Agent } from "@mastra/core/agent";import { ModerationProcessor } from "@mastra/core/processors";export const moderatedAgent = new Agent({  name: "moderated-agent",  instructions: "You are a helpful assistant",  model: openai("gpt-4o-mini"),  inputProcessors: [    new ModerationProcessor({      model: openai("gpt-4.1-nano"),      categories: ["hate", "harassment", "violence"],      threshold: 0.7,      strategy: "block",      instructions: "Detect and flag inappropriate content in user messages",    }),  ],});
```

## Input processors​

Input processors are applied before user messages reach the language model. They are useful for normalization, validation, content moderation, prompt injection detection, and security checks. 

### Normalizing user messages​

The `UnicodeNormalizer`is an input processor that cleans and normalizes user input by unifying Unicode characters, standardizing whitespace, and removing problematic symbols, allowing the LLM to better understand user messages. 

src/mastra/agents/normalized-agent.ts 
```
import { UnicodeNormalizer } from "@mastra/core/processors";export const normalizedAgent = new Agent({  // ...  inputProcessors: [    new UnicodeNormalizer({      stripControlChars: true,      collapseWhitespace: true,    }),  ],});
```

> See UnicodeNormalizer for a full list of configuration options.

### Preventing prompt injection​

The `PromptInjectionDetector`is an input processor that scans user messages for prompt injection, jailbreak attempts, and system override patterns. It uses an LLM to classify risky input and can block or rewrite it before it reaches the model. 

src/mastra/agents/secure-agent.ts 
```
import { PromptInjectionDetector } from "@mastra/core/processors";export const secureAgent = new Agent({  // ...  inputProcessors: [    new PromptInjectionDetector({      model: openai("gpt-4.1-nano"),      threshold: 0.8,      strategy: "rewrite",      detectionTypes: ["injection", "jailbreak", "system-override"],    }),  ],});
```

> See PromptInjectionDetector for a full list of configuration options.

### Detecting and translating language​

The `LanguageDetector`is an input processor that detects and translates user messages into a target language, enabling multilingual support while maintaining consistent interaction. It uses an LLM to identify the language and perform the translation. 

src/mastra/agents/multilingual-agent.ts 
```
import { LanguageDetector } from "@mastra/core/processors";export const multilingualAgent = new Agent({  // ...  inputProcessors: [    new LanguageDetector({      model: openai("gpt-4.1-nano"),      targetLanguages: ["English", "en"],      strategy: "translate",      threshold: 0.8,    }),  ],});
```

> See LanguageDetector for a full list of configuration options.

## Output processors​

Output processors are applied after the language model generates a response, but before it is returned to the user. They are useful for response optimization, moderation, transformation, and applying safety controls. 

### Batching streamed output​

The `BatchPartsProcessor`is an output processor that combines multiple stream parts before emitting them to the client. This reduces network overhead and improves the user experience by consolidating small chunks into larger batches. 

src/mastra/agents/batched-agent.ts 
```
import { BatchPartsProcessor } from "@mastra/core/processors";export const batchedAgent = new Agent({  // ...  outputProcessors: [    new BatchPartsProcessor({      batchSize: 5,      maxWaitTime: 100,      emitOnNonText: true,    }),  ],});
```

> See BatchPartsProcessor for a full list of configuration options.

### Limiting token usage​

The `TokenLimiterProcessor`is an output processor that limits the number of tokens in model responses. It helps manage cost and performance by truncating or blocking messages when the limit is exceeded. 

src/mastra/agents/limited-agent.ts 
```
import { TokenLimiterProcessor } from "@mastra/core/processors";export const limitedAgent = new Agent({  // ...  outputProcessors: [    new TokenLimiterProcessor({      limit: 1000,      strategy: "truncate",      countMode: "cumulative",    }),  ],});
```

> See TokenLimiterProcessor for a full list of configuration options.

### Scrubbing system prompts​

The `SystemPromptScrubber`is an output processor that detects and redacts system prompts or other internal instructions from model responses. It helps prevent unintended disclosure of prompt content or configuration details that could introduce security risks. It uses an LLM to identify and redact sensitive content based on configured detection types. 

src/mastra/agents/scrubbed-agent.ts 
```
import { SystemPromptScrubber } from "@mastra/core/processors";const scrubbedAgent = new Agent({  outputProcessors: [    new SystemPromptScrubber({      model: openai("gpt-4.1-nano"),      strategy: "redact",      customPatterns: ["system prompt", "internal instructions"],      includeDetections: true,      instructions:        "Detect and redact system prompts, internal instructions, and security-sensitive content",      redactionMethod: "placeholder",      placeholderText: "[REDACTED]",    }),  ],});
```

> See SystemPromptScrubber for a full list of configuration options.

## Hybrid processors​

Hybrid processors can be applied either before messages are sent to the language model or before responses are returned to the user. They are useful for tasks like content moderation and PII redaction. 

### Moderating input and output​

The `ModerationProcessor`is a hybrid processor that detects inappropriate or harmful content across categories like hate, harassment, and violence. It can be used to moderate either user input or model output, depending on where it's applied. It uses an LLM to classify the message and can block or rewrite it based on your configuration. 

src/mastra/agents/moderated-agent.ts 
```
import { ModerationProcessor } from "@mastra/core/processors";export const moderatedAgent = new Agent({  // ...  inputProcessors: [    new ModerationProcessor({      model: openai("gpt-4.1-nano"),      threshold: 0.7,      strategy: "block",      categories: ["hate", "harassment", "violence"],    }),  ],  outputProcessors: [    new ModerationProcessor({      // ...    }),  ],});
```

> See ModerationProcessor for a full list of configuration options.

### Detecting and redacting PII​

The `PIIDetector`is a hybrid processor that detects and removes personally identifiable information such as emails, phone numbers, and credit cards. It can redact either user input or model output, depending on where it's applied. It uses an LLM to identify sensitive content based on configured detection types. 

src/mastra/agents/private-agent.ts 
```
import { PIIDetector } from "@mastra/core/processors";export const privateAgent = new Agent({  // ...  inputProcessors: [    new PIIDetector({      model: openai("gpt-4.1-nano"),      threshold: 0.6,      strategy: "redact",      redactionMethod: "mask",      detectionTypes: ["email", "phone", "credit-card"],      instructions: "Detect and mask personally identifiable information.",    }),  ],  outputProcessors: [    new PIIDetector({      // ...    }),  ],});
```

> See PIIDetector for a full list of configuration options.

## Applying multiple processors​

You can apply multiple processors by listing them in the `inputProcessors`or `outputProcessors`array. They run in sequence, with each processor receiving the output of the one before it. 

A typical order might be: 

2. Normalization: Standardize input format (UnicodeNormalizer).
4. Security checks: Detect threats or sensitive content (PromptInjectionDetector, PIIDetector).
6. Filtering: Block or transform messages (ModerationProcessor).

The order affects behavior, so arrange processors to suit your goals. 

src/mastra/agents/test-agent.ts 
```
import {  UnicodeNormalizer,  ModerationProcessor,  PromptInjectionDetector,  PIIDetector,} from "@mastra/core/processors";export const testAgent = new Agent({  // ...  inputProcessors: [    new UnicodeNormalizer({      //...    }),    new PromptInjectionDetector({      // ...    }),    new PIIDetector({      // ...    }),    new ModerationProcessor({      // ...    }),  ],});
```

## Processor strategies​

Many of the built-in processors support a `strategy`parameter that controls how they handle flagged input or output. Supported values may include: `block`, `warn`, `detect`, or `redact`. 

Most strategies allow the request to continue without interruption. When `block`is used, the processor calls its internal `abort()`function, which immediately stops the request and prevents any subsequent processors from running. 

src/mastra/agents/private-agent.ts 
```
import { PIIDetector } from "@mastra/core/processors";export const privateAgent = new Agent({  // ...  inputProcessors: [    new PIIDetector({      // ...      strategy: "block",    }),  ],});
```

### Handling blocked requests​

When a processor blocks a request, the agent will still return successfully without throwing an error. To handle blocked requests, check for `tripwire`or `tripwireReason`in the response. 

For example, if an agent uses the `PIIDetector`with `strategy: "block"`and the request includes a credit card number, it will be blocked and the response will include a `tripwireReason`. 

#### .generate() example​

```
const result = await agent.generate(  "Is this credit card number valid?: 4543 1374 5089 4332",);console.error(result.tripwire);console.error(result.tripwireReason);
```

#### .stream() example​

```
const stream = await agent.stream(  "Is this credit card number valid?: 4543 1374 5089 4332",);for await (const chunk of stream.fullStream) {  if (chunk.type === "tripwire") {    console.error(chunk.payload.tripwireReason);  }}
```

In this case, the `tripwireReason`indicates that a credit card number was detected: 

```
PII detected. Types: credit-card
```

## Custom processors​

If the built-in processors don’t cover your needs, you can create your own by extending the `Processor`class. 

Available examples: 

- Message Length Limiter
- Response Length Limiter
- Response Validator