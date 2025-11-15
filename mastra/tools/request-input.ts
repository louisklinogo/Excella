import { z } from "zod";

import { createTool } from "@mastra/core/tools";

export const requestInputTool = createTool({
  id: "request-input",
  description:
    "Request specific input or information from the user when additional data is needed to complete a task.",
  inputSchema: z.object({
    label: z.string().describe("Label for the input"),
    placeholder: z.string().describe("Placeholder for the input"),
  }),
});
