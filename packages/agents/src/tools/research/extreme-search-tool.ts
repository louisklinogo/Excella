import { createModel } from "@excella/core";
import { xai, type XaiProviderOptions } from "@ai-sdk/xai";
import { Daytona } from "@daytonaio/sdk";
import { createTool } from "@mastra/core/tools";
import { generateObject, generateText, stepCountIs } from "ai";
import Exa from "exa-js";
import { getTweet } from "react-tweet/api";
import { z } from "zod";

import { getFirecrawlClient } from "./common";

const pythonLibsAvailable = [
  "pandas",
  "numpy",
  "scipy",
  "keras",
  "seaborn",
  "matplotlib",
  "transformers",
  "scikit-learn",
];

const SNAPSHOT_NAME =
  process.env.DAYTONA_SNAPSHOT_NAME ?? "excella-python-snapshot";

type SearchResult = {
  title: string;
  url: string;
  content: string;
  publishedDate: string;
  favicon: string;
};

export type Research = {
  text: string;
  toolResults: unknown[];
  sources: SearchResult[];
  charts: unknown[];
};

enum SearchCategory {
  NEWS = "news",
  COMPANY = "company",
  RESEARCH_PAPER = "research paper",
  GITHUB = "github",
  FINANCIAL_REPORT = "financial report",
}

const getExaClient = (): Exa => {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error("EXA_API_KEY is required for extreme search.");
  }

  return new Exa(apiKey);
};

const runCode = async (code: string, installLibs: string[] = []) => {
  const apiKey = process.env.DAYTONA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "DAYTONA_API_KEY is required to run Python code via Daytona."
    );
  }

  const daytona = new Daytona({
    apiKey,
    target: "us",
  });

  const sandbox = await daytona.create({
    snapshot: SNAPSHOT_NAME,
  });

  if (installLibs.length > 0) {
    await sandbox.process.executeCommand(`pip install ${installLibs.join(" ")}`);
  }

  const result = await sandbox.process.codeRun(code);

  await sandbox.delete();

  return result;
};

const searchWeb = async (
  query: string,
  category?: SearchCategory,
  includeDomains?: string[]
) => {
  const exa = getExaClient();

  try {
    const { results } = await exa.searchAndContents(query, {
      numResults: 8,
      type: "auto",
      ...(category
        ? {
            category,
          }
        : {}),
      ...(includeDomains
        ? {
            include_domains: includeDomains,
          }
        : {}),
    });

    const mappedResults = results.map(
      (r) =>
        ({
          title: (r.title as string | undefined) ?? "",
          url: r.url as string,
          content: (r.text as string | undefined) ?? "",
          publishedDate: (r.publishedDate as string | undefined) ?? "",
          favicon:
            (r.favicon as string | undefined) ??
            `https://www.google.com/s2/favicons?domain=${new URL(r.url as string).hostname}&sz=128`,
        }) satisfies SearchResult
    );

    return mappedResults;
  } catch (error) {
    console.error("Error in searchWeb:", error);
    return [] as SearchResult[];
  }
};

const getContents = async (links: string[]) => {
  const exa = getExaClient();
  const firecrawl = await getFirecrawlClient();

  const results: SearchResult[] = [];
  const failedUrls: string[] = [];

  try {
    const result = await exa.getContents(links, {
      text: {
        maxCharacters: 3000,
        includeHtmlTags: false,
      },
      livecrawl: "preferred",
    });

    for (const r of result.results) {
      if (r.text && (r.text as string).trim()) {
        results.push({
          title:
            (r.title as string | undefined) ||
            (r.url as string).split("/").pop() ||
            "Retrieved Content",
          url: r.url as string,
          content: r.text as string,
          publishedDate: (r.publishedDate as string | undefined) ?? "",
          favicon:
            (r.favicon as string | undefined) ||
            `https://www.google.com/s2/favicons?domain=${new URL(r.url as string).hostname}&sz=128`,
        });
      } else {
        failedUrls.push(r.url as string);
      }
    }

    const exaUrls = result.results.map((r) => r.url as string);
    const missingUrls = links.filter((url) => !exaUrls.includes(url));
    failedUrls.push(...missingUrls);
  } catch (error) {
    console.error("Exa API error in getContents:", error);
    failedUrls.push(...links);
  }

  if (failedUrls.length > 0) {
    for (const url of failedUrls) {
      try {
        const scrapeResponse = await firecrawl.scrape(url, {
          formats: ["markdown"],
          proxy: "auto",
          storeInCache: true,
          parsers: ["pdf"],
        });

        if (scrapeResponse.markdown) {
          results.push({
            title:
              (scrapeResponse.metadata?.title as string | undefined) ||
              url.split("/").pop() ||
              "Retrieved Content",
            url,
            content: (scrapeResponse.markdown as string).slice(0, 3000),
            publishedDate:
              (scrapeResponse.metadata?.publishedDate as string | undefined) ||
              "",
            favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`,
          });
        }
      } catch (firecrawlError) {
        console.error(`Firecrawl error for ${url}:`, firecrawlError);
      }
    }
  }

  return results;
};

async function extremeSearch(prompt: string): Promise<Research> {
  const allSources: SearchResult[] = [];

  const { object: result } = await generateObject({
    model: createModel(),
    schema: z.object({
      plan: z
        .array(
          z.object({
            title: z
              .string()
              .min(10)
              .max(70)
              .describe("A title for the research topic"),
            todos: z
              .array(z.string())
              .min(3)
              .max(5)
              .describe("A list of what to research for the given title"),
          })
        )
        .min(1)
        .max(5),
    }),
    prompt: `
Plan out the research for the following topic: ${prompt}.

Today's Date: ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      weekday: "short",
    })}.

Plan Guidelines:
- Break down the topic into key aspects to research
- Generate specific, diverse search queries for each aspect
- Search for relevant information using the web search tool
- Analyze the results and identify important facts and insights
- The plan is limited to 15 actions, do not exceed this limit!
- Follow up with more specific queries as you learn more
- Add todos for code execution if it is asked for by the user
- No need to synthesize your findings into a comprehensive response, just return the results
- The plan should be concise and to the point, no more than 10 items
- Keep the titles concise and to the point, no more than 70 characters
- Mention if the topic needs to use the xSearch tool
- Mention any need for visualizations in the plan
- Make the plan technical and specific to the topic`,
  });

  const plan = result.plan as Array<{
    title: string;
    todos: string[];
  }>;

  const totalTodos = plan.reduce((acc, curr) => acc + curr.todos.length, 0);

  const toolResults: any[] = [];
  const hasXaiApiKey =
    typeof process.env.XAI_API_KEY === "string" &&
    process.env.XAI_API_KEY.length > 0;

  const tools: {
    [name: string]: {
      description: string;
      inputSchema: z.ZodTypeAny;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: (input: any) => Promise<unknown>;
    };
  } = {
    codeRunner: {
      description: "Run Python code in a sandbox",
      inputSchema: z.object({
        title: z
          .string()
          .describe("The title of what you are running the code for"),
        code: z
          .string()
          .describe("The Python code to run with proper syntax and imports"),
      }),
      async execute({ title, code }: { title: string; code: string }) {
        const imports = code.match(/import\s+([\w\s,]+)/);
        const importLibs = imports
          ? imports[1].split(",").map((lib: string) => lib.trim())
          : [];
        const missingLibs = importLibs.filter(
          (lib: string) => !pythonLibsAvailable.includes(lib)
        );

        const response = await runCode(code, missingLibs);

        const charts =
          response.artifacts?.charts?.map((chart: any) => {
            if (chart.png) {
              const { png, ...chartWithoutPng } = chart;
              return chartWithoutPng;
            }
            return chart;
          }) || [];

        return {
          result: response.result,
          charts,
          title,
        };
      },
    },
    webSearch: {
      description: "Search the web for information on a topic",
      inputSchema: z.object({
        query: z
          .string()
          .describe("The search query to achieve the todo")
          .max(150),
        category: z
          .nativeEnum(SearchCategory)
          .optional()
          .describe("The category of the search if relevant"),
        includeDomains: z
          .array(z.string())
          .optional()
          .describe("The domains to include in the search for results"),
      }),
      async execute({
        query,
        category,
        includeDomains,
      }: {
        query: string;
        category?: SearchCategory;
        includeDomains?: string[];
      }) {
        const results = await searchWeb(query, category, includeDomains);

        allSources.push(...results);

        if (results.length > 0) {
          try {
            const urls = results.map((r) => r.url);
            const contentsResults = await getContents(urls);

            if (contentsResults && contentsResults.length > 0) {
              return contentsResults.map((content) => ({
                title: content.title,
                url: content.url,
                content: content.content,
                publishedDate: content.publishedDate,
              }));
            }
          } catch (error) {
            console.error("Error fetching content:", error);
          }
        }

        return results.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          publishedDate: r.publishedDate,
        }));
      },
    },
  };

  if (hasXaiApiKey) {
    tools.xSearch = {
      description:
        "Search X (formerly Twitter) posts for recent information and discussions",
      inputSchema: z.object({
        query: z
          .string()
          .describe("The search query for X posts")
          .max(150),
        startDate: z
          .string()
          .optional()
          .describe(
            "The start date of the search in the format YYYY-MM-DD (default to 7 days ago if not specified)"
          ),
        endDate: z
          .string()
          .optional()
          .describe(
            "The end date of the search in the format YYYY-MM-DD (default to today if not specified)"
          ),
        xHandles: z
          .array(z.string())
          .optional()
          .describe(
            "Optional list of X handles/usernames to search from (without @ symbol). Only include if user explicitly mentions specific handles"
          ),
        maxResults: z
          .number()
          .optional()
          .describe(
            "Maximum number of search results to return (default 15)"
          ),
      }),
      async execute({
        query,
        startDate,
        endDate,
        xHandles,
        maxResults = 15,
      }: {
        query: string;
        startDate?: string;
        endDate?: string;
        xHandles?: string[];
        maxResults?: number;
      }) {
        try {
          const searchStartDate =
            startDate ||
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0];
          const searchEndDate =
            endDate || new Date().toISOString().split("T")[0];

          const { text: xText, sources } = await generateText({
            model: xai("grok-4-fast-non-reasoning"),
            system:
              "You are a helpful assistant that searches for X posts and returns the results in a structured format. You will be given a search query and a list of X handles to search from. You will then search for the posts and return the results in a structured format. You will also cite the sources in the format [Source No.]. Go very deep in the search and return the most relevant results.",
            messages: [{ role: "user", content: query }],
            maxOutputTokens: 10,
            providerOptions: {
              xai: {
                searchParameters: {
                  mode: "on",
                  fromDate: searchStartDate,
                  toDate: searchEndDate,
                  maxSearchResults: maxResults < 15 ? 15 : maxResults,
                  returnCitations: true,
                  sources: [
                    xHandles && xHandles.length > 0
                      ? { type: "x", xHandles }
                      : { type: "x" },
                  ],
                },
              } satisfies XaiProviderOptions,
            },
          });

          const citations = sources || [];
          const allTweetSources: {
            text: string;
            link: string;
            title: string;
          }[] = [];

          if (citations.length > 0) {
            const tweetFetchPromises = citations
              .filter((link) => link.sourceType === "url")
              .map(async (link) => {
                try {
                  const tweetUrl =
                    link.sourceType === "url" ? (link.url as string) : "";
                  const tweetId =
                    tweetUrl.match(/\/status\/(\d+)/)?.[1] || "";

                  const tweetData = await getTweet(tweetId);
                  if (!tweetData) return null;

                  const tweetText = tweetData.text;
                  if (!tweetText) return null;

                  const userHandle =
                    tweetData.user?.screen_name ||
                    tweetData.user?.name ||
                    "unknown";
                  const textPreview =
                    tweetText.slice(0, 20) +
                    (tweetText.length > 20 ? "..." : "");
                  const generatedTitle = `Post from @${userHandle}: ${textPreview}`;

                  return {
                    text: tweetText,
                    link: tweetUrl,
                    title: generatedTitle,
                  };
                } catch (error) {
                  console.error(
                    `Error fetching tweet data for ${
                      link.sourceType === "url" ? (link.url as string) : ""
                    }`,
                    error
                  );
                  return null;
                }
              });

            const tweetResults = await Promise.all(tweetFetchPromises);
            allTweetSources.push(
              ...tweetResults.filter(
                (
                  result
                ): result is { text: string; link: string; title: string } =>
                  result !== null
              )
            );
          }

          return {
            content: xText,
            citations,
            sources: allTweetSources,
            dateRange: `${searchStartDate} to ${searchEndDate}`,
            handles: xHandles || [],
          };
        } catch (error) {
          console.error("X search error:", error);
          throw error;
        }
      },
    };
  }

  const { text } = await generateText({
    model: createModel(),
    stopWhen: stepCountIs(totalTodos),
    system: `
You are an autonomous deep research analyst for Excella. Your goal is to research the given research plan thoroughly with the given tools.

Today's Date: ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      weekday: "short",
    })}.

PRIMARY FOCUS: SEARCH-DRIVEN RESEARCH (95% of your work)
Your main job is to SEARCH extensively and gather comprehensive information. Search should be your go-to approach for almost everything.
Make sure to be mindful of today's date and time and use it to your advantage when searching for information.

For searching:
- PRIORITIZE SEARCH OVER CODE - Search first, search often, search comprehensively
- Do not run all the queries at once, run them one by one, wait for the results before running the next query
- Make 3-5 targeted searches per research topic to get different angles and perspectives
- Search queries should be specific and focused, 5-15 words maximum
- You can use include domains to filter results by specific websites or sources
- Vary your search approaches: broad overview → specific details → recent developments → expert opinions
- Use different categories strategically: news, research papers, company info, financial reports, github
${hasXaiApiKey ? "- Use X search for real-time discussions, public opinion, breaking news, and social media trends" : ""}
- Follow up initial searches with more targeted queries based on what you learn
- Cross-reference information by searching for the same topic from different angles
- Search for contradictory information to get balanced perspectives
- Include exact metrics, dates, technical terms, and proper nouns in queries
- Make searches progressively more specific as you gather context
- Search for recent developments, trends, and updates on topics
- Always verify information with multiple searches from different sources

Only use code when:
- You need to process or analyze data that was found through searches
- Mathematical calculations are required that cannot be found through search
- Creating visualizations of data trends that were discovered through research
- The research plan specifically requests data analysis or calculations

Code guidelines (when absolutely necessary):
- Keep code simple and focused on the specific calculation or analysis needed
- Always end with print() statements for any results
- Prefer data visualization (line charts, bar charts only) when showing trends or any comparisons or other visualizations
- Import required libraries: pandas, numpy, matplotlib, scipy as needed

RESEARCH WORKFLOW:
1. Start with broad searches to understand the topic landscape
2. Identify key subtopics and drill down with specific searches
3. Look for recent developments and trends through targeted news/research searches
4. Cross-validate information with searches from different categories
5. Use code execution if mathematical analysis is needed on the gathered data or if you need or are asked to visualize the data
6. Continue searching to fill any gaps in understanding

For research:
- Carefully follow the plan, do not skip any steps
- Do not use the same query twice to avoid duplicates
- The plan is limited to ${totalTodos} actions with 2 extra actions in case of errors, do not exceed this limit but use it fully to get the most information!

Research Plan:
${JSON.stringify(plan)}
`,
    prompt,
    temperature: 0,
    tools,
    onStepFinish: (step) => {
      if (step.toolResults) {
        toolResults.push(...step.toolResults);
      }
    },
  });

  const chartResults = toolResults.filter(
    (result) =>
      result.toolName === "codeRunner" &&
      typeof result.result === "object" &&
      result.result !== null &&
      "charts" in result.result
  );

  const charts = chartResults.flatMap(
    (result) => (result.result as any).charts || []
  );

  return {
    text,
    toolResults,
    sources: Array.from(
      new Map(
        allSources.map((s) => [
          s.url,
          { ...s, content: `${s.content.slice(0, 3000)}...` },
        ])
      ).values()
    ),
    charts,
  };
}

export const extremeSearchTool = createTool({
  id: "research.extreme_search",
  description:
    "Conduct an extreme search on a given topic: plan research, run multiple web and X searches, optionally execute Python code, and return structured sources and charts.",
  inputSchema: z.object({
    prompt: z
      .string()
      .describe(
        "This should take the user's exact prompt. Extract from the context but do not infer or change in any way."
      ),
  }),
  outputSchema: z.object({
    research: z.object({
      text: z.string(),
      toolResults: z.array(z.unknown()),
      sources: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
          content: z.string(),
          publishedDate: z.string(),
          favicon: z.string(),
        })
      ),
      charts: z.array(z.unknown()),
    }),
  }),
  async execute({ context }) {
    const { prompt } = context as { prompt: string };

    const research = await extremeSearch(prompt);

    return {
      research,
    };
  },
});
