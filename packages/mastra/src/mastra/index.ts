import { chatAgent, humanInTheLoopAgent } from "@excella/agents";
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  agents: {
    chatAgent,
    humanInTheLoopAgent,
  },
  server: {
    port: 4111,
    host: "0.0.0.0",
  },
});
