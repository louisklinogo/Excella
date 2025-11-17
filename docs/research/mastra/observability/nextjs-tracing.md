# Next.js Tracing | Observability

Set up OpenTelemetry tracing for Next.js applications

Source: https://mastra.ai/docs/observability/nextjs-tracing

---

# Next.js Tracing

Next.js requires additional configuration to enable OpenTelemetry tracing. 

### Step 1: Next.js Configuration​

Start by enabling the instrumentation hook in your Next.js config: 

next.config.ts 
```
import type { NextConfig } from "next";const nextConfig: NextConfig = {  experimental: {    instrumentationHook: true, // Not required in Next.js 15+  },};export default nextConfig;
```

### Step 2: Mastra Configuration​

Configure your Mastra instance: 

mastra.config.ts 
```
import { Mastra } from "@mastra/core";export const mastra = new Mastra({  // ... other config  telemetry: {    serviceName: "your-project-name",    enabled: true,  },});
```

### Step 3: Configure your providers​

If you're using Next.js, you have two options for setting up OpenTelemetry instrumentation: 

#### Option 1: Using a Custom Exporter​

The default that will work across providers is to configure a custom exporter: 

2. Install the required dependencies (example using Langfuse):

```
npm install @opentelemetry/api langfuse-vercel
```

2. Create an instrumentation file:

instrumentation.ts 
```
import {  NodeSDK,  ATTR_SERVICE_NAME,  resourceFromAttributes,} from "@mastra/core/telemetry/otel-vendor";import { LangfuseExporter } from "langfuse-vercel";export function register() {  const exporter = new LangfuseExporter({    // ... Langfuse config  });  const sdk = new NodeSDK({    resource: resourceFromAttributes({      [ATTR_SERVICE_NAME]: "ai",    }),    traceExporter: exporter,  });  sdk.start();}
```

#### Option 2: Using Vercel's Otel Setup​

If you're deploying to Vercel, you can use their OpenTelemetry setup: 

2. Install the required dependencies:

```
npm install @opentelemetry/api @vercel/otel
```

2. Create an instrumentation file at the root of your project (or in the src folder if using one):

instrumentation.ts 
```
import { registerOTel } from "@vercel/otel";export function register() {  registerOTel({ serviceName: "your-project-name" });}
```

### Summary​

This setup will enable OpenTelemetry tracing for your Next.js application and Mastra operations. 

For more details, see the documentation for: 

- Next.js Instrumentation
- Vercel OpenTelemetry