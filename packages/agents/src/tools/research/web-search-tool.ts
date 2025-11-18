import { createTool } from "@mastra/core/tools";
import Exa from "exa-js";
import Parallel from "parallel-web";
import { tavily, type TavilyClient } from "@tavily/core";
import { z } from "zod";

import {
  cleanTitle,
  deduplicateByDomainAndUrl,
  getFirecrawlClient,
  imageResultSchema,
  webResultSchema,
} from "./common";

const searchResultSchema = z.object({
  query: z.string(),
  results: z.array(webResultSchema),
  images: z.array(imageResultSchema),
});

interface SearchStrategy {
  search(
    queries: string[],
    options: {
      maxResults: number[];
      topics: ("general" | "news")[];
      quality: ("default" | "best")[];
    },
  ): Promise<{
    searches: Array<{
      query: string;
      results: z.infer<typeof webResultSchema>[];
      images: z.infer<typeof imageResultSchema>[];
    }>;
  }>;
}

class ParallelSearchStrategy implements SearchStrategy {
  constructor(
    private readonly parallel: Parallel,
    private readonly firecrawl: Awaited<ReturnType<typeof getFirecrawlClient>>,
  ) {}

  async search(
    queries: string[],
    options: {
      maxResults: number[];
      topics: ("general" | "news")[];
      quality: ("default" | "best")[];
    },
  ) {
    const limitedQueries = queries.slice(0, 5);

    const perQueryPromises = limitedQueries.map(async (query, index) => {
      const currentQuality =
        options.quality[index] || options.quality[0] || "default";
      const currentMaxResults =
        options.maxResults[index] || options.maxResults[0] || 10;

      try {
        const [singleResponse, firecrawlImages] = await Promise.all([
          this.parallel.beta.search({
            objective: query,
            search_queries: [query],
            processor: currentQuality === "best" ? "pro" : "base",
            max_results: Math.max(currentMaxResults, 10),
            max_chars_per_result: 1000,
          }),
          this.firecrawl
            .search(query, {
              sources: ["images"],
              limit: 3,
            })
            .catch(() => ({ images: [] } as any)),
        ]);

        const results = (singleResponse?.results || []).map((result: any) => ({
          url: result.url as string,
          title: cleanTitle(result.title || ""),
          content: Array.isArray(result.excerpts)
            ? result.excerpts.join(" ").substring(0, 1000)
            : (result.content || "").substring(0, 1000),
          publishedDate: undefined,
        }));

        const images = ((firecrawlImages as any)?.images || [])
          .filter((item: any) => item && (item.imageUrl || item.url))
          .map((item: any) => ({
            url: (item.imageUrl || item.url) as string,
            description: cleanTitle(item.title || ""),
          }))
          .filter((item: any) => item.url);

        return {
          query,
          results: deduplicateByDomainAndUrl(results),
          images: deduplicateByDomainAndUrl(images),
        };
      } catch (error) {
        console.error(`Parallel AI search error for query "${query}":`, error);

        return {
          query,
          results: [],
          images: [],
        };
      }
    });

    const searchResults = await Promise.all(perQueryPromises);
    return { searches: searchResults };
  }
}

class TavilySearchStrategy implements SearchStrategy {
  constructor(private readonly tvly: TavilyClient) {}

  async search(
    queries: string[],
    options: {
      maxResults: number[];
      topics: ("general" | "news")[];
      quality: ("default" | "best")[];
    },
  ) {
    const searchPromises = queries.map(async (query, index) => {
      const currentTopic =
        options.topics[index] || options.topics[0] || "general";
      const currentMaxResults =
        options.maxResults[index] || options.maxResults[0] || 10;
      const currentQuality =
        options.quality[index] || options.quality[0] || "default";

      try {
        const tavilyData = await this.tvly.search(query, {
          topic: currentTopic || "general",
          days: currentTopic === "news" ? 7 : undefined,
          maxResults: currentMaxResults,
          searchDepth: currentQuality === "best" ? "advanced" : "basic",
          includeAnswer: true,
          includeImages: true,
          includeImageDescriptions: true,
        });

        const results = deduplicateByDomainAndUrl(tavilyData.results).map(
          (obj: any) => ({
            url: obj.url as string,
            title: cleanTitle(obj.title || ""),
            content: obj.content as string,
            publishedDate:
              currentTopic === "news" ? (obj.published_date as string) : undefined,
          }),
        );

        const images = (tavilyData.images || [])
          .map((img: any) => ({
            url: img.url as string,
            description: (img.description as string) || "",
          }))
          .filter((img: any) => img.url && img.description);

        return {
          query,
          results: deduplicateByDomainAndUrl(results),
          images: deduplicateByDomainAndUrl(images),
        };
      } catch (error) {
        console.error(`Tavily search error for query "${query}":`, error);

        return {
          query,
          results: [],
          images: [],
        };
      }
    });

    const searchResults = await Promise.all(searchPromises);
    return { searches: searchResults };
  }
}

class FirecrawlSearchStrategy implements SearchStrategy {
  constructor(private readonly firecrawl: Awaited<ReturnType<typeof getFirecrawlClient>>) {}

  async search(
    queries: string[],
    options: {
      maxResults: number[];
      topics: ("general" | "news")[];
      quality: ("default" | "best")[];
    },
  ) {
    const searchPromises = queries.map(async (query, index) => {
      const currentTopic =
        options.topics[index] || options.topics[0] || "general";
      const currentMaxResults =
        options.maxResults[index] || options.maxResults[0] || 10;

      try {
        const sources: ("web" | "news" | "images")[] = [];

        if (currentTopic === "news") {
          sources.push("news", "web");
        } else {
          sources.push("web");
        }
        sources.push("images");

        const firecrawlData = await this.firecrawl.search(query, {
          sources,
          limit: currentMaxResults,
        });

        let results: z.infer<typeof webResultSchema>[] = [];

        if (firecrawlData?.web && Array.isArray(firecrawlData.web)) {
          const webResults = firecrawlData.web as any[];
          results = deduplicateByDomainAndUrl(webResults).map((result) => ({
            url: result.url as string,
            title: cleanTitle(result.title || ""),
            content: (result.description as string) || "",
            publishedDate: undefined,
          }));
        }

        if (
          firecrawlData?.news &&
          Array.isArray(firecrawlData.news) &&
          currentTopic === "news"
        ) {
          const newsResults = firecrawlData.news as any[];
          const processedNewsResults = deduplicateByDomainAndUrl(newsResults).map(
            (result) => ({
              url: result.url as string,
              title: cleanTitle(result.title || ""),
              content: (result.snippet as string) || "",
              publishedDate: (result.date as string) || undefined,
            }),
          );

          results = [...processedNewsResults, ...results];
        }

        let images: z.infer<typeof imageResultSchema>[] = [];
        if (firecrawlData?.images && Array.isArray(firecrawlData.images)) {
          const imageResults = firecrawlData.images as any[];
          const processedImages = imageResults
            .map((image) => ({
              url: (image.imageUrl || image.url) as string,
              description: cleanTitle(image.title || ""),
            }))
            .filter((img) => img.url);
          images = deduplicateByDomainAndUrl(processedImages);
        }

        return {
          query,
          results: deduplicateByDomainAndUrl(results),
          images: images.filter((img) => img.url && img.description),
        };
      } catch (error) {
        console.error(`Firecrawl search error for query "${query}":`, error);

        return {
          query,
          results: [],
          images: [],
        };
      }
    });

    const searchResults = await Promise.all(searchPromises);
    return { searches: searchResults };
  }
}

class ExaSearchStrategy implements SearchStrategy {
  constructor(private readonly exa: Exa) {}

  async search(
    queries: string[],
    options: {
      maxResults: number[];
      topics: ("general" | "news")[];
      quality: ("default" | "best")[];
    },
  ) {
    const searchPromises = queries.map(async (query, index) => {
      const currentTopic =
        options.topics[index] || options.topics[0] || "general";
      const currentMaxResults =
        options.maxResults[index] || options.maxResults[0] || 10;
      const currentQuality =
        options.quality[index] || options.quality[0] || "default";

      try {
        const searchOptions: any = {
          text: true,
          type: currentQuality === "best" ? "hybrid" : "auto",
          numResults: currentMaxResults < 10 ? 10 : currentMaxResults,
          livecrawl: "preferred",
          useAutoprompt: true,
          category: currentTopic === "news" ? "news" : "",
        };

        const data = await this.exa.searchAndContents(query, searchOptions);

        const collectedImages: z.infer<typeof imageResultSchema>[] = [];

        const results: z.infer<typeof webResultSchema>[] = data.results.map(
          (result: any) => {
            if (result.image) {
              collectedImages.push({
                url: result.image as string,
                description: cleanTitle(
                  result.title ||
                    (result.text?.substring(0, 100) as string) + "..." ||
                    "",
                ),
              });
            }

            return {
              url: result.url as string,
              title: cleanTitle(result.title || ""),
              content: (result.text as string || "").substring(0, 1000),
              publishedDate:
                currentTopic === "news" && result.publishedDate
                  ? (result.publishedDate as string)
                  : undefined,
            };
          },
        );

        const images = deduplicateByDomainAndUrl(collectedImages);

        return {
          query,
          results: deduplicateByDomainAndUrl(results),
          images: images.filter((img) => img.url && img.description),
        };
      } catch (error) {
        console.error(`Exa search error for query "${query}":`, error);

        return {
          query,
          results: [],
          images: [],
        };
      }
    });

    const searchResults = await Promise.all(searchPromises);
    return { searches: searchResults };
  }
}

type Provider = "exa" | "parallel" | "tavily" | "firecrawl";

const getSearchProvider = (): Provider => {
  const raw = process.env.RESEARCH_SEARCH_PROVIDER;
  if (raw === "exa" || raw === "parallel" || raw === "tavily" || raw === "firecrawl") {
    return raw;
  }
  return "firecrawl";
};

const createSearchStrategy = async (provider: Provider): Promise<SearchStrategy> => {
  if (provider === "exa") {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      throw new Error("EXA_API_KEY is required for Exa-based search.");
    }
    return new ExaSearchStrategy(new Exa(apiKey));
  }

  if (provider === "parallel") {
    const apiKey = process.env.PARALLEL_API_KEY;
    if (!apiKey) {
      throw new Error("PARALLEL_API_KEY is required for Parallel-based search.");
    }
    const firecrawl = await getFirecrawlClient();
    return new ParallelSearchStrategy(new Parallel({ apiKey }), firecrawl);
  }

  if (provider === "tavily") {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error("TAVILY_API_KEY is required for Tavily-based search.");
    }
    return new TavilySearchStrategy(tavily({ apiKey }));
  }

  const firecrawl = await getFirecrawlClient();
  return new FirecrawlSearchStrategy(firecrawl);
};

export const webSearchTool = createTool({
  id: "research.web_search",
  description: `Search the web for information with multiple queries, max results, topics, and quality.
  Very important rules (mirroring Scira's behavior):
  - Use 3-5 focused queries per research topic whenever possible.
  - Keep queries in the user's language.
  - Prefer 'default' quality; only use 'best' when depth is critical.
  - Include date/time context in queries for time-sensitive topics (e.g. "latest", "${new Date().getFullYear()}", "today").
  `,
  inputSchema: z.object({
    queries: z
      .array(
        z
          .string()
          .describe(
            "Array of 3-5 search queries to look up on the web. Minimum 3, maximum 5 where possible."
          ),
      )
      .min(3)
      .max(5),
    maxResults: z
      .array(
        z
          .number()
          .describe(
            "Maximum number of results per query. Default is 10. Minimum is 8. Maximum is 15."
          ),
      )
      .optional(),
    topics: z
      .array(
        z
          .enum(["general", "news"])
          .describe(
            "Topic type per query. Use 'news' for time-sensitive topics; otherwise 'general'."
          ),
      )
      .optional(),
    quality: z
      .array(
        z
          .enum(["default", "best"])
          .describe(
            "Search effort per query. 'default' is usually enough; 'best' may be slower."
          ),
      )
      .optional(),
  }),
  outputSchema: z.object({
    searches: z.array(searchResultSchema),
  }),
  async execute({ context }) {
    const { queries, maxResults, topics, quality } = context as {
      queries: string[];
      maxResults?: number[];
      topics?: ("general" | "news")[];
      quality?: ("default" | "best")[];
    };

    const provider = getSearchProvider();
    const strategy = await createSearchStrategy(provider);

    const normalizedMaxResults = maxResults && maxResults.length > 0
      ? maxResults
      : new Array(queries.length).fill(10);

    const normalizedTopics = topics && topics.length > 0
      ? topics
      : new Array(queries.length).fill("general" as const);

    const normalizedQuality = quality && quality.length > 0
      ? quality
      : new Array(queries.length).fill("default" as const);

    return await strategy.search(queries, {
      maxResults: normalizedMaxResults,
      topics: normalizedTopics,
      quality: normalizedQuality,
    });
  },
});
