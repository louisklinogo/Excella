import { z } from "zod";

export const useFirecrawl = (): boolean =>
  typeof process.env.FIRECRAWL_API_KEY === "string" &&
  process.env.FIRECRAWL_API_KEY.trim().length > 0;

export const getFirecrawlClient = async () => {
  const FirecrawlApp = (await import("@mendable/firecrawl-js")).default;
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "FIRECRAWL_API_KEY is required to use Firecrawl-based research tools."
    );
  }

  return new FirecrawlApp({ apiKey });
};

export const extractDomain = (url: string): string => {
  if (!url) return "";
  const urlPattern = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i;
  const match = url.match(urlPattern);
  return match?.[1] ?? url;
};

export const deduplicateByDomainAndUrl = <T extends { url: string }>(
  items: T[]
): T[] => {
  const seenDomains = new Set<string>();
  const seenUrls = new Set<string>();

  return items.filter((item) => {
    const domain = extractDomain(item.url);
    const isNewUrl = !seenUrls.has(item.url);
    const isNewDomain = !seenDomains.has(domain);

    if (isNewUrl && isNewDomain) {
      seenUrls.add(item.url);
      seenDomains.add(domain);
      return true;
    }

    return false;
  });
};

export const cleanTitle = (title: string): string =>
  title
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const webResultSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
  publishedDate: z.string().optional(),
});

export type WebResult = z.infer<typeof webResultSchema>;

export const imageResultSchema = z.object({
  url: z.string(),
  description: z.string().optional(),
});

export type ImageResult = z.infer<typeof imageResultSchema>;
