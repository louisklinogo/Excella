"use client";

import { useChat } from "@ai-sdk/react";
import type { ToolUIPart } from "ai";
import {
  ChevronRightIcon,
  CopyIcon,
  DatabaseIcon,
  GlobeIcon,
  RefreshCcwIcon,
  SquareIcon,
} from "lucide-react";
import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from "@/components/ai-elements/plan";
import { useRef, useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { MessageSourcesSheet } from "@/components/ai-elements/message-sources";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { VoiceInputButton } from "@/components/ai-elements/voice-input-button";
import { Button } from "@/components/ui/button";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { WebSearchSources } from "@/components/ai-elements/web-search-sources";
import type { SourceUrlPart } from "@/lib/chat-stream";
import { tryGetExcelContextSnapshot } from "@/lib/excel/context-environment";
import { cn } from "@/lib/utils";
import {
  getPlanFromToolPart,
  isToolUIPart,
  type PlanToolEntry,
} from "@/lib/hooks/plan-types";
import { usePlanExecution } from "@/lib/hooks/use-plan-execution";
import { useVoiceInput } from "@/lib/hooks/use-voice-input";

const ChatBotDemo = () => {
  const [input, setInput] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [databaseSources, setDatabaseSources] = useState(false);
  const [cancelledMessageId, setCancelledMessageId] = useState<string | null>(
    null
  );
  const {
    voiceControlsRef,
    audioStream,
    setAudioStream,
    isRecording,
    setIsRecording,
    isTranscribing,
    setIsTranscribing,
    isVoiceActive,
  } = useVoiceInput();
  const [messageBranches, setMessageBranches] = useState<
    Record<string, string[]>
  >({});
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { messages, sendMessage, status, regenerate, stop } = useChat({
    api: "/api/chat",
    experimental_throttle: 50,
  });

  const { executingPlanMessageId, localPlanTools, executePlan } =
    usePlanExecution();
  const sourcesActive = webSearch || databaseSources;

  const getBranchGroupId = (messageId: string) => {
    const messageIndex = messages.findIndex(
      (candidate) => candidate.id === messageId
    );

    if (messageIndex === -1) {
      return messageId;
    }

    const previousUserMessage = [...messages.slice(0, messageIndex)]
      .reverse()
      .find((candidate) => candidate.role === "user");

    return previousUserMessage?.id ?? messageId;
  };

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  const lastAssistantHasText =
    lastAssistantMessage?.parts.some(
      (part) => part.type === "text" && part.text.trim()
    ) ?? false;

  const isThinking =
    status === "submitted" || (status === "streaming" && !lastAssistantHasText);

  const handleStop = () => {
    if (lastAssistantMessage) {
      setCancelledMessageId(lastAssistantMessage.id);
    }
    stop();
  };

  const handleRegenerateLast = async () => {
    if (!lastAssistantMessage) {
      return;
    }

    const lastAssistantTextPart = lastAssistantMessage.parts.find(
      (part) => part.type === "text"
    );

    if (!lastAssistantTextPart) {
      return;
    }

    const branchGroupId = getBranchGroupId(lastAssistantMessage.id);

    setMessageBranches((previous) => {
      const existingBranches = previous[branchGroupId] ?? [];

      return {
        ...previous,
        [branchGroupId]: [...existingBranches, lastAssistantTextPart.text],
      };
    });

    setCancelledMessageId(null);

    await regenerate();
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    const excelSnapshot = await tryGetExcelContextSnapshot({
      includeFormulaSamples: false,
      includeDependencySummaries: false,
    });

    const mode: "default" | "research" = webSearch ? "research" : "default";

    setCancelledMessageId(null);

    sendMessage(
      {
        text: message.text || "Sent with attachments",
        files: message.files,
      },
      {
        body: {
          webSearch,
          databaseSources,
          excelSnapshot,
          mode,
        },
      }
    );
    setInput("");
  };

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden px-1 py-2 text-[12px] sm:px-2 sm:text-[13px] lg:mx-auto lg:max-w-4xl lg:px-4 lg:py-6 lg:text-[15px]">
      <div className="flex min-h-0 flex-1 flex-col">
        <Conversation className="min-h-0">
          <ConversationContent>
            {messages.map((message, index) => {
              const isAssistant = message.role === "assistant";
              const isLastAssistant =
                isAssistant &&
                lastAssistantMessage &&
                lastAssistantMessage.id === message.id;

              const branchGroupId = getBranchGroupId(message.id);

              const textPart = message.parts.find(
                (part) => part.type === "text"
              );
              const reasoningParts = message.parts.filter(
                (part) => part.type === "reasoning"
              );
              const sourceParts = message.parts.filter(
                (part) => part.type === "source-url"
              );

              const serverToolUIParts = message.parts.filter(isToolUIPart);

              const localToolsForMessage = localPlanTools[message.id] ?? [];

              const rawToolUIParts = [
                ...serverToolUIParts,
                ...localToolsForMessage,
              ];

              const isCancelled =
                cancelledMessageId !== null &&
                cancelledMessageId === message.id;

              const toolUIParts = rawToolUIParts.map((part) => {
                if (
                  isCancelled &&
                  (part.state === "input-streaming" ||
                    part.state === "input-available")
                ) {
                  return {
                    ...part,
                    state: "output-denied",
                    errorText: part.errorText ?? "Cancelled",
                  } as ToolUIPart;
                }

                return part;
              });

              const planToolEntry = toolUIParts.reduce<PlanToolEntry | null>(
                (current, part) => {
                  if (current) {
                    return current;
                  }

                  const output = getPlanFromToolPart(part);

                  if (!output) {
                    return current;
                  }

                  return output;
                },
                null
              );

              const existingBranches = messageBranches[branchGroupId] ?? [];
              const branches = textPart
                ? [...existingBranches, textPart.text]
                : existingBranches;

              return (
                <div key={`${message.id}-${index}`}>
                  {isAssistant && planToolEntry && (
                    <Plan
                      className="mb-3"
                      defaultOpen
                      isStreaming={
                        ![
                          "output-available",
                          "output-error",
                          "output-denied",
                        ].includes(planToolEntry.part.state)
                      }
                    >
                      <PlanHeader>
                        <div className="flex w-full items-start justify-between gap-3">
                          <div className="space-y-1">
                            <PlanTitle>
                              {planToolEntry.kind === "excel"
                                ? "Proposed Excel plan"
                                : "Proposed research plan"}
                            </PlanTitle>
                            <PlanDescription>
                              {planToolEntry.output.summary ??
                                (planToolEntry.kind === "excel"
                                  ? "Review this plan before applying changes to your workbook."
                                  : planToolEntry.output.question ??
                                    "Review this research plan before executing the steps.")}
                            </PlanDescription>
                          </div>
                          <PlanTrigger />
                        </div>
                      </PlanHeader>
                      <PlanContent>
                        {planToolEntry.kind === "excel" ? (
                          <ol className="mt-1 list-decimal space-y-1 pl-5 text-[11px] sm:text-[12px]">
                            {planToolEntry.output.plan.steps.map(
                              (step, stepIndex) => (
                                <li key={step.id ?? stepIndex}>
                                  <div className="font-medium">
                                    {step.description}
                                  </div>
                                  <div className="text-muted-foreground text-[10px]">
                                    {step.kind} • {step.targetWorksheet} {" "}
                                    {step.targetRange}
                                  </div>
                                </li>
                              )
                            )}
                          </ol>
                        ) : (
                          <ol className="mt-1 list-decimal space-y-1 pl-5 text-[11px] sm:text-[12px]">
                            {planToolEntry.output.steps.map(
                              (step, stepIndex) => (
                                <li key={step.id ?? stepIndex}>
                                  <div className="font-medium">
                                    {step.description ?? "Research step"}
                                  </div>
                                  <div className="text-muted-foreground text-[10px]">
                                    {step.kind ?? "step"}
                                    {step.query
                                      ? ` • ${step.query}`
                                      : null}
                                  </div>
                                  {step.notes && (
                                    <div className="text-muted-foreground text-[10px]">
                                      {step.notes}
                                    </div>
                                  )}
                                </li>
                              )
                            )}
                          </ol>
                        )}
                      </PlanContent>
                      <PlanFooter>
                        <PlanAction>
                          <Button
                            disabled={executingPlanMessageId === message.id}
                            onClick={() =>
                              planToolEntry &&
                              executePlan(planToolEntry, message.id)
                            }
                            size="xs"
                            variant="default"
                          >
                            {executingPlanMessageId === message.id
                              ? "Running plan..."
                              : planToolEntry.kind === "excel"
                                ? "Preview plan (dry-run)"
                                : "Run research plan"}
                          </Button>
                        </PlanAction>
                      </PlanFooter>
                    </Plan>
                  )}

                  {isAssistant &&
                    toolUIParts
                      .filter(
                        (toolPart) =>
                          !planToolEntry || toolPart !== planToolEntry.part
                      )
                      .map((toolPart, toolIndex) => (
                        <Tool
                          defaultOpen={
                            toolPart.state === "output-available" ||
                            toolPart.state === "output-error" ||
                            toolPart.state === "output-denied"
                          }
                          key={`${message.id}-tool-${toolIndex}`}
                        >
                          <ToolHeader
                            state={toolPart.state}
                            type={toolPart.type}
                          />
                          <ToolContent>
                            {toolPart.input && (
                              <ToolInput input={toolPart.input} />
                            )}
                            <ToolOutput
                              errorText={toolPart.errorText}
                              output={toolPart.output}
                            />
                          </ToolContent>
                        </Tool>
                      ))}

                  {isAssistant && sourceParts.length > 0 && (
                    <WebSearchSources
                      sources={sourceParts as SourceUrlPart[]}
                    />
                  )}

                  {reasoningParts.map((part, reasoningIndex) => (
                    <Reasoning
                      className="w-full"
                      isStreaming={
                        status === "streaming" &&
                        reasoningIndex === message.parts.length - 1 &&
                        message.id === messages.at(-1)?.id
                      }
                      key={`${message.id}-reasoning-${reasoningIndex}`}
                    >
                      <ReasoningTrigger />
                      <ReasoningContent>{part.text}</ReasoningContent>
                    </Reasoning>
                  ))}

                  {textPart && isAssistant && branches.length > 0 && (
                    <MessageBranch
                      className="w-full"
                      defaultBranch={Math.max(branches.length - 1, 0)}
                      key={`${branchGroupId}-${branches.length}`}
                    >
                      <MessageBranchContent>
                        {branches.map((branchText, branchIndex) => (
                          <Message
                            from={message.role}
                            key={`${message.id}-branch-${branchIndex}`}
                          >
                            <MessageContent>
                              <MessageResponse>{branchText}</MessageResponse>
                            </MessageContent>
                            {isLastAssistant && (
                              <MessageActions className="gap-3">
                                <MessageBranchSelector from={message.role}>
                                  <MessageBranchPrevious />
                                  <MessageBranchPage />
                                  <MessageBranchNext />
                                </MessageBranchSelector>
                                {sourceParts.length > 0 && (
                                  <MessageSourcesSheet
                                    sources={sourceParts as SourceUrlPart[]}
                                  />
                                )}
                                {status === "streaming" ||
                                status === "submitted" ? (
                                  <MessageAction
                                    label="Stop"
                                    onClick={handleStop}
                                  >
                                    <SquareIcon className="size-3" />
                                  </MessageAction>
                                ) : (
                                  <MessageAction
                                    label="Retry"
                                    onClick={handleRegenerateLast}
                                  >
                                    <RefreshCcwIcon className="size-3" />
                                  </MessageAction>
                                )}
                                <MessageAction
                                  label="Copy"
                                  onClick={() =>
                                    navigator.clipboard.writeText(branchText)
                                  }
                                >
                                  <CopyIcon className="size-3" />
                                </MessageAction>
                              </MessageActions>
                            )}
                          </Message>
                        ))}
                      </MessageBranchContent>
                    </MessageBranch>
                  )}

                  {textPart && !isAssistant && (
                    <Message from={message.role}>
                      <MessageContent>
                        <MessageResponse>{textPart.text}</MessageResponse>
                      </MessageContent>
                    </Message>
                  )}
                </div>
              );
            })}
            {isThinking && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer as="p" className="text-[11px] text-muted-foreground">
                    Thinking...
                  </Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput
          className="mt-2 text-[12px] sm:mt-3 sm:text-[13px]"
          globalDrop
          multiple
          onSubmit={handleSubmit}
        >
          <PromptInputHeader>
            {!isVoiceActive && (
              <PromptInputAttachments>
                {(attachment) => <PromptInputAttachment data={attachment} />}
              </PromptInputAttachments>
            )}
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              className={cn(isVoiceActive && "opacity-60")}
              onChange={(e) => setInput(e.target.value)}
              readOnly={isVoiceActive}
              ref={textareaRef}
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter>
            {isVoiceActive ? (
              <PromptInputTools className="w-full items-center gap-2">
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <div className="flex flex-1 items-center gap-1 overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    {audioStream && isRecording ? (
                      <LiveWaveform
                        audioStream={audioStream}
                        barCount={80}
                        className="w-full max-w-full"
                        maxHeight={24}
                        minHeight={6}
                      />
                    ) : (
                      <div className="h-[2px] w-full rounded bg-muted" />
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      aria-label="Cancel recording"
                      className="h-6 w-6 rounded-full border-none bg-transparent shadow-none hover:bg-accent/40"
                      onClick={() => {
                        setIsRecording(false);
                        voiceControlsRef.current?.cancel();
                      }}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <span className="text-sm">✕</span>
                    </Button>
                    <Button
                      aria-label="Confirm recording"
                      className="h-6 w-6 rounded-full border-none bg-transparent shadow-none hover:bg-accent/60"
                      disabled={isTranscribing}
                      onClick={() => {
                        if (isTranscribing) {
                          return;
                        }
                        setIsTranscribing(true);
                        setIsRecording(false);
                        voiceControlsRef.current?.confirm();
                      }}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      {isTranscribing ? (
                        <Loader size={14} />
                      ) : (
                        <span className="text-base">✓</span>
                      )}
                    </Button>
                  </div>
                </div>
              </PromptInputTools>
            ) : (
              <>
                <PromptInputTools>
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                  <div
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full border px-0.5 py-0.5 text-[10px] sm:text-[11px]",
                      sourcesActive ? "border-accent bg-accent/10" : "bg-muted"
                    )}
                  >
                    <Button
                      aria-label="Toggle web sources"
                      className={cn(
                        "h-4 w-4 rounded-full border-none bg-transparent shadow-none hover:bg-accent/60",
                        webSearch && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => setWebSearch(!webSearch)}
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                    >
                      <GlobeIcon className="size-2.5" />
                    </Button>
                    <Button
                      aria-label="Toggle database sources"
                      className={cn(
                        "h-4 w-4 rounded-full border-none bg-transparent shadow-none hover:bg-accent/40",
                        databaseSources && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => setDatabaseSources(!databaseSources)}
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                    >
                      <DatabaseIcon className="size-2.5" />
                    </Button>
                    <span className="flex items-center gap-0.5 px-0.5 text-muted-foreground">
                      Sources
                      <ChevronRightIcon className="size-2.5" />
                    </span>
                  </div>
                </PromptInputTools>
                <div className="flex items-center gap-1">
                  <VoiceInputButton
                    getCurrentText={() => input}
                    onAudioStreamChange={setAudioStream}
                    onControlsReady={(controls) => {
                      voiceControlsRef.current = controls;
                    }}
                    onRecordingStateChange={setIsRecording}
                    onTranscriptionChange={setInput}
                    size="icon-xs"
                    textareaRef={textareaRef}
                    onTranscriptionStatusChange={(transcriptionStatus) => {
                      if (transcriptionStatus === "processing") {
                        setIsTranscribing(true);
                      }
                      if (
                        transcriptionStatus === "idle" ||
                        transcriptionStatus === "success" ||
                        transcriptionStatus === "error"
                      ) {
                        setIsTranscribing(false);
                      }
                    }}
                  />
                  <PromptInputSubmit
                    disabled={!(input || status)}
                    onStop={handleStop}
                    status={status}
                  />
                </div>
              </>
            )}
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBotDemo;
