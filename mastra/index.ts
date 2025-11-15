import { Mastra } from "@mastra/core";
import { humanInTheLoopAgent } from "./agents/human-in-the-loop-agent";
import { ConsoleLogger } from "@mastra/core/logger";

export const mastra = new Mastra({
  agents: { humanInTheLoopAgent },
  // storage: new LibSQLStore({
  //   // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
  //   url: ":memory:",
  // }),
  logger: new ConsoleLogger(),
});
