# OTEL Tracing | Observability

Set up OpenTelemetry tracing for Mastra applications

Source: https://mastra.ai/docs/observability/otel-tracing

---

# OTEL Tracing

Mastra supports the OpenTelemetry Protocol (OTLP) for tracing and monitoring your application. When telemetry is enabled, Mastra automatically traces all core primitives including agent operations, LLM interactions, tool executions, integration calls, workflow runs, and database operations. Your telemetry data can then be exported to any OTEL collector. 

### Basic Configuration​

Here's a simple example of enabling telemetry: 

mastra.config.ts 
```
export const mastra = new Mastra({  // ... other config  telemetry: {    serviceName: "my-app",    enabled: true,    sampling: {      type: "always_on",    },    export: {      type: "otlp",      endpoint: "http://localhost:4318", // SigNoz local endpoint    },  },});
```

### Configuration Options​

The telemetry config accepts these properties: 

```
type OtelConfig = {  // Name to identify your service in traces (optional)  serviceName?: string;  // Enable/disable telemetry (defaults to true)  enabled?: boolean;  // Control how many traces are sampled  sampling?: {    type: "ratio" | "always_on" | "always_off" | "parent_based";    probability?: number; // For ratio sampling    root?: {      probability: number; // For parent_based sampling    };  };  // Where to send telemetry data  export?: {    type: "otlp" | "console";    endpoint?: string;    headers?: Record<string, string>;  };};
```

See the inline type definition above for more details. 

### Environment Variables​

You can configure the OTLP endpoint and headers through environment variables: 

.env 
```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318OTEL_EXPORTER_OTLP_HEADERS=x-api-key=your-api-key
```

Then in your config: 

mastra.config.ts 
```
export const mastra = new Mastra({  // ... other config  telemetry: {    serviceName: "my-app",    enabled: true,    export: {      type: "otlp",      // endpoint and headers will be picked up from env vars    },  },});
```

### Example: SigNoz Integration​

Here's what a traced agent interaction looks like in [SigNoz](https://signoz.io): 

### Other Supported Providers​

Mastra supports any OTLP-compatible observability platform including Datadog, New Relic, Jaeger, and others. Configure them using the same OTLP endpoint pattern shown above. 

### Custom Instrumentation files​

You can define custom instrumentation files in your Mastra project by placing them in the `/mastra`folder. Mastra automatically detects and bundles these files instead of using the default instrumentation. 

#### Supported File Types​

Mastra looks for instrumentation files with these extensions: 

- instrumentation.js
- instrumentation.ts
- instrumentation.mjs

#### Example​

/mastra/instrumentation.ts 
```
import { NodeSDK } from "@opentelemetry/sdk-node";import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";const sdk = new NodeSDK({  traceExporter: new OTLPTraceExporter({    url: "http://localhost:4318/v1/traces",  }),  instrumentations: [getNodeAutoInstrumentations()],});sdk.start();
```

When Mastra finds a custom instrumentation file, it automatically replaces the default instrumentation and bundles it during the build process. 

### Tracing Outside Mastra Server Environment​

When using `mastra start`or `mastra dev`commands, Mastra automatically provisions and loads the necessary instrumentation files for tracing. However, when using Mastra as a dependency in your own application (outside the Mastra server environment), you'll need to manually provide the instrumentation file. 

To enable tracing in this case: 

2. Enable Mastra telemetry in your configuration:

```
export const mastra = new Mastra({  telemetry: {    enabled: true,  },});
```

2. Create an instrumentation file in your project (e.g., instrumentation.mjs):

```
import { NodeSDK } from "@opentelemetry/sdk-node";import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";const sdk = new NodeSDK({  traceExporter: new OTLPTraceExporter(),  instrumentations: [getNodeAutoInstrumentations()],});sdk.start();
```

2. Add OpenTelemetry environment variables:

```
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.braintrust.dev/otelOTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <Your API Key>, x-bt-parent=project_name:<Your Project Name>"
```

2. Run the OpenTelemetry SDK before your application:

```
node --import=./instrumentation.mjs --import=@opentelemetry/instrumentation/hook.mjs src/index.js
```

### Next.js-specific Tracing steps​

If you're using Next.js, you have three additional configuration steps: 

2. Enable the instrumentation hook in next.config.ts
4. Configure Mastra telemetry settings
6. Set up an OpenTelemetry exporter

For implementation details, see the [Next.js Tracing](/docs/observability/nextjs-tracing)guide.