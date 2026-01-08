"use client";

import { BookOpenIcon, ArrowUpRightIcon } from "lucide-react";
import type { HTMLAttributes } from "react";
import type { SourceUrlPart } from "@/lib/chat-stream";
import { cn } from "@/lib/utils";

export type WebSearchSourcesProps = HTMLAttributes<HTMLDivElement> & {
  sources: SourceUrlPart[];
};

const getDomainFromUrl = (url: string): string | null => {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

export const WebSearchSources = ({
  sources,
  className,
  ...props
}: WebSearchSourcesProps) => {
  if (!sources || sources.length === 0) {
    return null;
  }

  const count = sources.length;
  const previewSources = sources.slice(0, 4);

  return (
    <div
      className={cn(
        "not-prose mb-3 space-y-2 text-[11px] text-muted-foreground",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <BookOpenIcon className="h-3.5 w-3.5" />
          <span className="font-medium text-xs text-foreground">
            Reviewed {count} {count === 1 ? "source" : "sources"}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-muted/40">
        {previewSources.map((source) => {
          const domain = getDomainFromUrl(source.url) ?? source.url;
          const title = source.title?.trim() || domain;
          const snippet = source.snippet?.trim();

          return (
            <a
              className="group flex items-start gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-muted"
              href={source.url}
              key={source.sourceId}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-background text-[10px] font-medium uppercase text-muted-foreground">
                {domain.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 font-medium text-[11px] text-foreground">
                    {title}
                  </p>
                  <ArrowUpRightIcon className="h-3 w-3 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                {snippet && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed">
                    {snippet}
                  </p>
                )}
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {domain}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
};
