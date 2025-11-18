import { humanInTheLoopAgent } from "@excella/agents";
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  agents: {
    humanInTheLoopAgent,
  },
  telemetry: {
    serviceName: "excella-ai-platform",
    enabled: true,
  },
});
