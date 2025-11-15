import { makeAssistantToolUI } from "@assistant-ui/react";
import { useMemo, useState } from "react";
import { ChevronDown, SendIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const trimContent = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
};

const getHostname = (url: string) => {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const FirecrawlToolUI = makeAssistantToolUI<
  {
    url: string;
  },
  {
    content?: string;
  }
>({
  toolName: "firecrawlTool",
  render: function Render({ args, result, status }) {
    const isLoading = status.type === "running";
    const hostname = useMemo(() => getHostname(args.url), [args.url]);
    const snippet = useMemo(() => {
      if (!result?.content) {
        return undefined;
      }

      return trimContent(result.content.replace(/\s+/g, " "), 280);
    }, [result?.content]);
    const [isOpen, setIsOpen] = useState(true);

    return (
      <div
        className="my-3"
        style={{
          animation: "fadeInUp 0.4s ease-out forwards",
        }}
      >
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-center gap-2 text-sm font-semibold text-slate-700"
          aria-expanded={isOpen}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              !isOpen && "-rotate-90",
            )}
          />
          {isLoading ? "Browsing" : "Browsed"} {hostname}
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out",
            isOpen ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          aria-hidden={!isOpen}
        >
          <div className="overflow-hidden pl-6 text-sm leading-relaxed text-slate-600">
            {isLoading ? (
              <div className="space-y-2" aria-live="polite" aria-busy="true">
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
                <span className="sr-only">Browsing {hostname}</span>
              </div>
            ) : snippet ? (
              <p className="whitespace-pre-wrap text-slate-700">{snippet}</p>
            ) : (
              <span className="text-slate-400">No content returned.</span>
            )}
          </div>
        </div>
      </div>
    );
  },
});

export const SendEmailToolUI = makeAssistantToolUI<
  {
    emailHandle: string;
  },
  {
    response: string;
  }
>({
  toolName: "sendEmailTool",
  render: function Render({ args, status }) {
    const isLoading = status.type === "running";
    const shortHandle = useMemo(
      () => args?.emailHandle?.slice(0, 8),
      [args.emailHandle],
    );

    return (
      <div
        className="my-3 flex items-center gap-2"
        style={{
          animation: "fadeInUp 0.4s ease-out forwards",
        }}
      >
        <SendIcon className="h-4 w-4" />
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          {isLoading ? "Sending" : "Sent"} email
          {shortHandle && (
            <span className="text-sm font-medium text-slate-500">
              {shortHandle}
            </span>
          )}
        </div>
      </div>
    );
  },
});
