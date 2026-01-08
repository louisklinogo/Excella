import type { UIMessage } from "ai";
import { createUIMessageStream } from "ai";

export type SourceUrlPart = {
  type: "source-url";
  sourceId: string;
  url: string;
  title?: string;
  snippet?: string;
  publishedDate?: string;
  favicon?: string;
};

type StreamWriter = {
  write: (chunk: unknown) => void;
};

type SourceCandidate = {
  url?: unknown;
  title?: unknown;
  content?: unknown;
  description?: unknown;
  publishedDate?: unknown;
  favicon?: unknown;
};

const writeSourceUrl = (
  candidate: SourceCandidate,
  writer: StreamWriter,
  seenSourceUrls: Set<string>
): void => {
  const { url, title, content, description, publishedDate, favicon } =
    candidate;

  if (typeof url !== "string" || seenSourceUrls.has(url)) {
    return;
  }

  seenSourceUrls.add(url);

  let rawSnippet: string | undefined;

  if (typeof description === "string" && description.trim().length > 0) {
    rawSnippet = description;
  } else if (typeof content === "string") {
    rawSnippet = content;
  }

  const part: SourceUrlPart = {
    type: "source-url",
    sourceId: url,
    url,
    title:
      typeof title === "string" && title.trim().length > 0 ? title : undefined,
    snippet:
      typeof rawSnippet === "string" && rawSnippet.trim().length > 0
        ? rawSnippet.slice(0, 300)
        : undefined,
    publishedDate:
      typeof publishedDate === "string" && publishedDate.trim().length > 0
        ? publishedDate
        : undefined,
    favicon:
      typeof favicon === "string" && favicon.trim().length > 0
        ? favicon
        : undefined,
  };

  writer.write(part);
};

const writeSourceUrlsFromSearches = (
  rawSearches: unknown,
  writer: StreamWriter,
  seenSourceUrls: Set<string>
): void => {
  if (!Array.isArray(rawSearches)) {
    return;
  }

  for (const search of rawSearches) {
    if (!search || typeof search !== "object") {
      continue;
    }

    const results = (search as { results?: unknown }).results;

    if (!Array.isArray(results)) {
      continue;
    }

    for (const result of results) {
      writeSourceUrl(result as SourceCandidate, writer, seenSourceUrls);
    }
  }
};

const writeSourceUrlsFromResearch = (
  rawResearch: unknown,
  writer: StreamWriter,
  seenSourceUrls: Set<string>
): void => {
  if (!rawResearch || typeof rawResearch !== "object") {
    return;
  }

  const sources = (rawResearch as { sources?: unknown }).sources;

  if (!Array.isArray(sources)) {
    return;
  }

  for (const source of sources) {
    writeSourceUrl(source as SourceCandidate, writer, seenSourceUrls);
  }
};

const writeSourceUrlsFromResults = (
  rawResults: unknown,
  writer: StreamWriter,
  seenSourceUrls: Set<string>
): void => {
  if (!Array.isArray(rawResults)) {
    return;
  }

  for (const item of rawResults) {
    writeSourceUrl(item as SourceCandidate, writer, seenSourceUrls);
  }
};

const writeSourceUrlsFromToolOutput = (
  rawOutput: unknown,
  writer: StreamWriter,
  seenSourceUrls: Set<string>
): void => {
  if (!rawOutput || typeof rawOutput !== "object") {
    return;
  }

  const output = rawOutput as {
    searches?: unknown;
    research?: unknown;
    results?: unknown;
  };

  writeSourceUrlsFromSearches(output.searches, writer, seenSourceUrls);
  writeSourceUrlsFromResearch(output.research, writer, seenSourceUrls);
  writeSourceUrlsFromResults(output.results, writer, seenSourceUrls);
};

const logStreamPart = (part: unknown): void => {
  // Temporary debug logging so we can see exactly what Mastra is emitting
  // eslint-disable-next-line no-console
  console.log("[mastra-chat] AI SDK part", JSON.stringify(part));
};

const shouldStopStream = (
  startTime: number,
  sawFinish: boolean,
  partCount: number,
  mode: "default" | "research" | undefined
): boolean => {
  if (sawFinish) {
    return false;
  }

  const elapsedMs = Date.now() - startTime;

  if (elapsedMs <= 120_000) {
    return false;
  }

  // eslint-disable-next-line no-console
  console.warn("[api/chat] stream guard triggered", {
    mode: mode ?? "default",
    elapsedMs,
    partCount,
  });

  return true;
};

export const createMastraUIMessageStream = ({
  stream,
  mode,
}: {
  stream: AsyncIterable<unknown>;
  mode: "default" | "research" | undefined;
}) =>
  createUIMessageStream({
    execute: async ({ writer }) => {
      const startTime = Date.now();
      let partCount = 0;
      let sawFinish = false;
      const seenSourceUrls = new Set<string>();

      for await (const part of stream as AsyncIterable<{ type?: string }>) {
        logStreamPart(part);
        writer.write(part);

        if ((part as { type?: string }).type === "tool-output-available") {
          const output = (part as { output?: unknown }).output;
          writeSourceUrlsFromToolOutput(output, writer, seenSourceUrls);
        }

        partCount += 1;
        if ((part as { type?: string }).type === "finish") {
          sawFinish = true;
        }

        if (shouldStopStream(startTime, sawFinish, partCount, mode)) {
          break;
        }
      }
    },
  });

export type ChatRequestBody = {
  messages: UIMessage[];
  excelSnapshot?: unknown;
  mode?: "default" | "research";
};
