import { createTool } from "@mastra/core/tools";
import Exa from "exa-js";
import { z } from "zod";

import {
  cleanTitle,
  deduplicateByDomainAndUrl,
  webResultSchema,
} from "./common";

const academicSearchResultSchema = z.object({
  query: z.string(),
  results: z.array(webResultSchema),
});

export const academicSearchTool = createTool({
  id: "research.academic_search",
  description:
    "Search academic papers and research with multiple queries. Mirrors Scira's Exa-based academic search.",
  inputSchema: z.object({
    queries: z
      .array(z.string())
      .describe(
        "Array of search queries for academic papers. Minimum 1, recommended 3-5."
      )
      .min(1)
      .max(5),
    maxResults: z
      .array(z.number())
      .optional()
      .describe("Array of maximum results per query. Default is 20 per query."),
  }),
  outputSchema: z.object({
    searches: z.array(academicSearchResultSchema),
  }),
  async execute({ context }) {
    const { queries, maxResults } = context as {
      queries: string[];
      maxResults?: number[];
    };

    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      throw new Error("EXA_API_KEY is required for academic search.");
    }

    const exa = new Exa(apiKey as string);

    const searches = await Promise.all(
      queries.map(async (query, index) => {
        const currentMaxResults = maxResults?.[index] || maxResults?.[0] || 20;

        try {
          const result = await exa.searchAndContents(query, {
            type: "auto",
            numResults: currentMaxResults,
            category: "research paper",
            summary: {
              query: "Abstract of the Paper",
            },
          });

          const processedResults = result.results.reduce<
            z.infer<typeof webResultSchema>[]
          >((acc, paper: any) => {
            if (acc.some((p) => p.url === paper.url) || !paper.summary) {
              return acc;
            }

            const cleanSummary = (paper.summary as string).replace(
              /^Summary:\s*/i,
              ""
            );
            const cleanedTitle = cleanTitle(paper.title || "");

            acc.push({
              url: paper.url as string,
              title: cleanedTitle,
              content: cleanSummary,
              publishedDate: paper.publishedDate as string | undefined,
            });

            return acc;
          }, []);

          return {
            query,
            results: deduplicateByDomainAndUrl(processedResults),
          };
        } catch (error) {
          console.error(`Academic search error for query "${query}":`, error);
          return {
            query,
            results: [],
          };
        }
      })
    );

    return {
      searches,
    };
  },
});
