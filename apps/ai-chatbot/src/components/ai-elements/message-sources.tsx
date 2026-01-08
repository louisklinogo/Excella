"use client";

import { BookOpenIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { SourceUrlPart } from "@/lib/chat-stream";
import { cn } from "@/lib/utils";

type MessageSourcesSheetProps = ComponentProps<"div"> & {
  sources: SourceUrlPart[];
};

const WWW_PREFIX_REGEX = /^www\./;

const getDomainFromUrl = (url: string): string | null => {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(WWW_PREFIX_REGEX, "");
  } catch {
    return null;
  }
};

export const MessageSourcesSheet = ({
  sources,
  className,
  ...props
}: MessageSourcesSheetProps) => {
  if (!sources || sources.length === 0) {
    return null;
  }

  const count = sources.length;

  return (
    <div className={cn("flex items-center", className)} {...props}>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            aria-label="View sources for this answer"
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
              "text-[10px] sm:text-[11px]",
              "border-border bg-muted hover:bg-accent/60"
            )}
            size="sm"
            type="button"
            variant="ghost"
          >
            <BookOpenIcon className="size-3" />
            <span>
              {count} {count === 1 ? "source" : "sources"}
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent
          className="w-3/4 max-w-xs p-0 text-[12px] sm:text-[13px]"
          side="right"
        >
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle>Sources for this answer</SheetTitle>
            <SheetDescription>
              Reviewed {count} {count === 1 ? "source" : "sources"}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3">
            <ul className="flex flex-col gap-2">
              {sources.map((source) => {
                const domain = getDomainFromUrl(source.url);
                const snippet = source.snippet?.trim();

                return (
                  <li key={source.url}>
                    <a
                      className="group flex flex-col gap-1 rounded-md border bg-muted/40 px-3 py-2 text-left hover:bg-muted"
                      href={source.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <div className="line-clamp-2 font-medium text-xs leading-snug">
                        {source.title?.trim() || source.url}
                      </div>
                      {snippet && (
                        <p className="line-clamp-1 text-[10px] text-muted-foreground">
                          {snippet}
                        </p>
                      )}
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {domain}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
