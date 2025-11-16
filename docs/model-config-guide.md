# Model Configuration Manager Guide

## Overview

The Model Configuration Manager provides a centralized, SOLID-compliant system for managing AI model providers (Anthropic Claude, Google Gemini) in the Excella project.

## Quick Start

### 1. Set Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Use Google Gemini (recommended)
MODEL_PROVIDER=google
MODEL_ID=gemini-flash-latest
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here

# Or use Anthropic Claude
MODEL_PROVIDER=anthropic
MODEL_ID=claude-sonnet-4-5
ANTHROPIC_API_KEY=your_key_here
```

### 2. Model Provider Will Auto-Configure

The agent automatically uses the configured provider. No code changes needed!

## Architecture

### Files Created

```
lib/config/
├── index.ts              # Main exports
├── env-config.ts         # Environment variable management
├── model-config.ts       # Model types and constants
└── model-factory.ts      # Factory pattern implementation
```

### Key Components

**ModelFactory** - Creates model instances
```typescript
import { ModelFactory } from "@/lib/config/model-factory";

// Use default from env
const model = ModelFactory.create();

// Override per use case
const model = ModelFactory.create({
  provider: "google",
  model: "gemini-2.5-pro"
});
```

## Available Models

### Google Gemini (Recommended)

**Auto-updating aliases** (recommended for development):
- `gemini-flash-latest` - Always latest Flash model
- `gemini-flash-lite-latest` - Always latest Flash-Lite
- `gemini-pro-latest` - Always latest Pro

**Stable versions** (recommended for production):
- `gemini-2.5-pro` - Most advanced reasoning
- `gemini-2.5-flash` - Best price-performance
- `gemini-2.5-flash-lite` - Fastest, lowest cost

### Anthropic Claude

- `claude-sonnet-4-5` - Latest, best coding model
- `claude-sonnet-4` - High performance
- `claude-opus-4` - Most capable
- `claude-haiku-3-5` - Fast and cost-effective

## Benefits

✅ **Easy Provider Switching** - Change one env variable  
✅ **No Hardcoded Dependencies** - Clean, maintainable code  
✅ **Type Safe** - Full TypeScript support  
✅ **SOLID Principles** - Open/Closed, Dependency Inversion  
✅ **Future Proof** - Easy to add OpenAI, Mistral, etc.  

## Migration

The `human-in-the-loop-agent.ts` has been refactored to use ModelFactory. All hardcoded Anthropic logic has been removed.

**Before:**
```typescript
const model = getAnthropicModel("claude-sonnet-4-20250514");
```

**After:**
```typescript
const model = ModelFactory.create();
```

## Adding New Providers

To add a new provider (e.g., OpenAI):

1. Install provider package: `bun add @ai-sdk/openai`
2. Update `ModelProvider` type in `model-config.ts`
3. Add provider constants to `model-config.ts`
4. Add factory method in `model-factory.ts`
5. Update `.env.example` with new variables

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MODEL_PROVIDER` | No | `google` | Provider to use: `google` or `anthropic` |
| `MODEL_ID` | No | `gemini-flash-latest` | Specific model ID |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes* | - | Google API key |
| `ANTHROPIC_API_KEY` | Yes* | - | Anthropic API key |
| `ANTHROPIC_BASE_URL` | No | Proxy URL | Custom Anthropic base URL |
| `TSAI_API_KEY` | No | - | TSAI proxy key for Anthropic |

*Required based on selected provider

## Troubleshooting

**Error: "GOOGLE_GENERATIVE_AI_API_KEY is required"**
- Set the API key in your `.env` file
- Get key from: https://aistudio.google.com/app/apikey

**Error: "Unsupported provider"**
- Check `MODEL_PROVIDER` is either `google` or `anthropic`

**Model not responding as expected**
- Verify `MODEL_ID` matches available models
- Check API key has proper permissions
- Review console for detailed error messages

## Best Practices

1. **Development**: Use `-latest` aliases for automatic improvements
2. **Production**: Use specific versions for stability
3. **Testing**: Override provider per test case for flexibility
4. **Cost Optimization**: Use `gemini-flash-lite-latest` for high-volume tasks
