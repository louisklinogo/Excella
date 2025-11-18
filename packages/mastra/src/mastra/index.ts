import { chatAgent, researchAgent, routingAgent } from "@excella/agents";
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  agents: {
    chatAgent,
    researchAgent,
    routingAgent,
  },
  server: {
    port: 4111,
    host: "0.0.0.0",
  },
});
