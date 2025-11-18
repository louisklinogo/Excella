import { chatAgent } from "@excella/agents";
import { Mastra } from "@mastra/core";

export const mastra = new Mastra({
  agents: {
    chatAgent,
  },
  server: {
    port: 4111,
    host: "0.0.0.0",
  },
});
