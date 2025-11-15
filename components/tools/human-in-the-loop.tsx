// import { mastra } from "@/mastra";
import { makeAssistantTool } from "@assistant-ui/react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { useState, useCallback } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";

import z from "zod";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import { generateId } from "ai";

export const HumanInTheLoopEmailTool = makeAssistantTool({
  toolName: "humanInTheLoopEmailTool",
  description: "Send an email about assistant-ui to a user",
  parameters: z.object({
    to: z.string().email("Please provide a valid email address"),
    subject: z
      .string()
      .optional()
      .describe("Email subject (defaults to 'Welcome to Assistant UI')"),
  }),
  execute: ({ to, subject }) => {
    return { to, subject, status: "execute" };
  },
  render: (data) => {
    return (
      <div className="my-3 flex gap-3 rounded-lg border px-4 py-2 shadow">
        <p>Render:</p>
        {JSON.stringify(data)}
      </div>
    );
  },
});

export const ProposeEmailToolUI = makeAssistantToolUI<
  {
    to: string;
    subject: string;
    body: string;
  },
  {
    emailHandle?: string;
    to: string;
    subject: string;
    body: string;
    approved?: boolean;
  }
>({
  toolName: "proposeEmailTool",
  render: function Render({ args, result, addResult, status }) {
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isRejected, setIsRejected] = useState(false);
    const emailBody = result?.body ?? args.body;

    const handleConfirm = useCallback(() => {
      setIsConfirmed(true);

      addResult({
        emailHandle: generateId(),
        to: args.to,
        subject: args.subject,
        body: emailBody,
        approved: true,
      });
    }, [addResult, args.subject, args.to, emailBody]);

    const handleReject = useCallback(() => {
      setIsRejected(true);

      addResult({
        to: args.to,
        subject: args.subject,
        body: emailBody,
        approved: false,
      });
    }, [addResult, args.subject, args.to, emailBody]);

    const isCompleted = status.type === "complete" || isConfirmed || isRejected;
    const approved = isCompleted ? isConfirmed || result?.approved : false;
    const isBodyLoading = status.type === "running";
    const isToolRejected =
      status.type === "incomplete" || (isCompleted && !approved);

    const headerStatus = isCompleted
      ? {
          Icon: approved ? CheckCircle2 : AlertCircle,
          label: approved ? "Email Approved" : "Email Rejected",
          className: approved ? "text-emerald-600" : "text-red-600",
        }
      : null;

    return (
      <div
        className={cn(
          "my-3 overflow-hidden rounded-lg border bg-white shadow-sm",
          isToolRejected ? "border-red-400" : "border-slate-200",
        )}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
          Email Approval
          {headerStatus && (
            <span
              className={cn(
                "ml-auto flex items-center gap-1 text-xs font-semibold",
                headerStatus.className,
              )}
            >
              <headerStatus.Icon className="h-4 w-4" aria-hidden />
              {headerStatus.label}
            </span>
          )}
        </div>

        <div className="divide-y divide-slate-200 text-sm text-slate-700">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              To
            </span>
            <span className="ml-4 flex-1 text-right break-words text-slate-700">
              {args.to}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              Subject
            </span>
            <span className="ml-4 flex-1 text-right break-words text-slate-700">
              {args.subject || "Welcome to Assistant UI"}
            </span>
          </div>

          <div className="px-4 py-4">
            {isBodyLoading ? (
              <div className="space-y-2" aria-live="polite" aria-busy="true">
                <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200" />
                <span className="sr-only">Generating email body…</span>
              </div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                {emailBody}
              </p>
            )}
          </div>
        </div>

        {!isCompleted && (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleReject}
              disabled={isBodyLoading}
            >
              Reject
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isBodyLoading}
            >
              Approve Draft
            </Button>
          </div>
        )}
      </div>
    );
  },
});

export const RequestInputToolUI = makeAssistantToolUI<
  {
    label: string;
    placeholder: string;
  },
  {
    result: string;
  }
>({
  toolName: "requestInputTool",
  render: function Render({ args, status, result, addResult }) {
    const isCompleted = status.type === "complete";
    const hasSubmittedValue = Boolean(result?.result);

    const [inputValue, setInputValue] = useState("");

    const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    }, []);

    const trimmedInput = inputValue.trim();
    const isInputValid = trimmedInput.length > 0;

    const handleSubmit = useCallback(() => {
      const nextValue = inputValue.trim();
      if (!nextValue) {
        return;
      }

      addResult({
        result: nextValue,
      });
    }, [addResult, inputValue]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !isCompleted && isInputValid) {
          handleSubmit();
        }
      },
      [handleSubmit, isCompleted, isInputValid],
    );

    return (
      <div
        className="my-3"
        style={{
          animation: "fadeInUp 0.4s ease-out forwards",
        }}
      >
        <div
          className={cn(
            "overflow-hidden rounded-lg border bg-white shadow-sm",
            status.type === "incomplete" ? "border-red-400" : "border-slate-200",
          )}
        >
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
            User Input
            {isCompleted && hasSubmittedValue && (
              <span className="ml-auto flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Submitted
              </span>
            )}
          </div>

          <div className="space-y-3 px-4 py-4 text-sm text-slate-600">
            <p className="text-slate-700">{args.label}</p>

            {isCompleted && hasSubmittedValue ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap text-slate-700">
                {result?.result}
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Provide the requested detail so the assistant can continue.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    className={cn(
                      "h-10 rounded-md border-slate-200 bg-white text-sm text-slate-700",
                      "focus-visible:border-slate-400 focus-visible:ring-0",
                    )}
                    aria-label={args.label}
                    placeholder={args.placeholder}
                    onChange={handleChange}
                    value={inputValue}
                    disabled={isCompleted}
                    onKeyDown={handleKeyDown}
                  />
                  <Button
                    type="button"
                    className="sm:self-start"
                    onClick={handleSubmit}
                    disabled={!isInputValid || isCompleted}
                  >
                    Submit
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  },
});
