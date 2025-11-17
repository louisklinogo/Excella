import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  telemetry: {
    serviceName: "excella-ai-platform",
    enabled: true,
  },
});
