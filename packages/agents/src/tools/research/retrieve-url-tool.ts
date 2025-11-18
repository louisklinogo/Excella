import { createTool } from "@mastra/core/tools";
import Exa from "exa-js";
import { z } from "zod";

import { getFirecrawlClient } from "./common";

const retrievedContentSchema = z.object({
  url: z.string(),
  content: z.string(),
  title: z.string(),
  description: z.string(),
  author: z.string().optional(),
  publishedDate: z.string().optional(),
  image: z.string().optional(),
  favicon: z.string().optional(),
  language: z.string().optional(),
});

export const retrieveUrlTool = createTool({
  id: "research.retrieve_url",
  description:
    "Retrieve the full content from a URL using Exa AI, with Firecrawl as a fallback. Returns text, title, summary, images, and more.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to retrieve the information from."),
    includeSummary: z
      .boolean()
      .optional()
      .describe(
        "Whether to include a summary of the content. Default is true."
      ),
    liveCrawl: z
      .enum(["never", "auto", "preferred"])
      .optional()
      .describe(
        'Whether to crawl the page immediately. Options: never, auto, preferred. Default is "preferred".'
      ),
  }),
  outputSchema: z.object({
    baseUrl: z.string(),
    results: z.array(retrievedContentSchema),
    responseTimeSeconds: z.number().optional(),
    source: z.enum(["exa", "firecrawl"]).optional(),
    error: z.string().optional(),
  }),
  async execute({ context }) {
    const {
      url,
      includeSummary = true,
      liveCrawl = "preferred",
    } = context as {
      url: string;
      includeSummary?: boolean;
      liveCrawl?: "never" | "auto" | "preferred";
    };

    try {
      const exaApiKey = process.env.EXA_API_KEY;
      const firecrawl = await getFirecrawlClient();

      const start = Date.now();
      let result: any;
      let usingFirecrawl = false;

      try {
        if (exaApiKey) {
          const exa = new Exa(exaApiKey as string);

          result = await exa.getContents([url], {
            text: true,
            summary: includeSummary ? true : undefined,
            livecrawl: liveCrawl,
          });

          if (
            !result.results ||
            result.results.length === 0 ||
            !result.results[0].text
          ) {
            usingFirecrawl = true;
          }
        } else {
          usingFirecrawl = true;
        }
      } catch (exaError) {
        console.error("Exa AI error:", exaError);
        usingFirecrawl = true;
      }

      if (usingFirecrawl) {
        const urlWithoutHttps = url.replace(/^https?:\/\//, "");
        try {
          const scrapeResponse = await firecrawl.scrape(urlWithoutHttps, {
            parsers: ["pdf"],
            proxy: "auto",
            storeInCache: true,
          });

          if (!scrapeResponse) {
            throw new Error(`Firecrawl failed: ${scrapeResponse}`);
          }

          const title =
            (scrapeResponse.metadata?.title as string | undefined) ||
            url.split("/").pop() ||
            "Retrieved Content";

          const description =
            (scrapeResponse.metadata?.description as string | undefined) ||
            `Content retrieved from ${url}`;

          const author =
            (scrapeResponse.metadata?.author as string | undefined) ||
            undefined;

          const publishedDate =
            (scrapeResponse.metadata?.publishedDate as string | undefined) ||
            undefined;

          const image =
            (scrapeResponse.metadata?.image as string | undefined) ||
            (scrapeResponse.metadata?.ogImage as string | undefined) ||
            undefined;

          const language =
            (scrapeResponse.metadata?.language as string | undefined) || "en";

          let favicon: string | undefined;
          try {
            const { hostname } = new URL(url);
            favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
          } catch {
            favicon = undefined;
          }

          const content =
            (scrapeResponse.markdown as string | undefined) ||
            ((scrapeResponse as any).html as string | undefined) ||
            "";

          return {
            baseUrl: url,
            results: [
              {
                url,
                content,
                title,
                description,
                author,
                publishedDate,
                image,
                favicon,
                language,
              },
            ],
            responseTimeSeconds: (Date.now() - start) / 1000,
            source: "firecrawl" as const,
          };
        } catch (firecrawlError) {
          console.error("Firecrawl error:", firecrawlError);
          return {
            baseUrl: url,
            results: [],
            responseTimeSeconds: (Date.now() - start) / 1000,
            source: "firecrawl" as const,
            error: "Both Exa AI and Firecrawl failed to retrieve content",
          };
        }
      }

      const mappedResults = (result!.results as any[]).map((item) => {
        const content =
          (item.text as string | undefined) ||
          (item.summary as string | undefined) ||
          "";

        const title =
          (item.title as string | undefined) ||
          (item.url as string).split("/").pop() ||
          "Retrieved Content";

        const description =
          (item.summary as string | undefined) ||
          `Content retrieved from ${item.url as string}`;

        const author = (item.author as string | undefined) || undefined;
        const publishedDate =
          (item.publishedDate as string | undefined) || undefined;
        const image = (item.image as string | undefined) || undefined;
        const favicon = (item.favicon as string | undefined) || undefined;

        return {
          url: item.url as string,
          content,
          title,
          description,
          author,
          publishedDate,
          image,
          favicon,
          language: "en",
        };
      });

      return {
        baseUrl: url,
        results: mappedResults,
        responseTimeSeconds: (Date.now() - start) / 1000,
        source: "exa" as const,
      };
    } catch (error) {
      console.error("retrieve_url error:", error);
      return {
        baseUrl: url,
        results: [],
        error:
          error instanceof Error ? error.message : "Failed to retrieve content",
      };
    }
  },
});
