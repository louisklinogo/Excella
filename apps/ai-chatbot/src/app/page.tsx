"use client";

import { useChat } from "@ai-sdk/react";
import {
  ChevronRightIcon,
  CopyIcon,
  DatabaseIcon,
  GlobeIcon,
  RefreshCcwIcon,
  SquareIcon,
} from "lucide-react";
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
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { VoiceInputButton } from "@/components/ai-elements/voice-input-button";
import { Button } from "@/components/ui/button";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { tryGetExcelContextSnapshot } from "@/lib/excel/context-environment";
import { cn } from "@/lib/utils";

const ChatBotDemo = () => {
  const [input, setInput] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [databaseSources, setDatabaseSources] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const voiceControlsRef = useRef<{
    start: () => void;
    confirm: () => void;
    cancel: () => void;
  } | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [messageBranches, setMessageBranches] = useState<
    Record<string, string[]>
  >({});
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { messages, sendMessage, status, regenerate, stop } = useChat({
    api: "/api/chat",
    experimental_throttle: 50,
  });

  const isVoiceActive = isRecording || isTranscribing;
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
      <div className="flex flex-1 min-h-0 flex-col">
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

              const existingBranches = messageBranches[branchGroupId] ?? [];
              const branches = textPart
                ? [...existingBranches, textPart.text]
                : existingBranches;

              return (
                <div key={`${message.id}-${index}`}>
                  {isAssistant && sourceParts.length > 0 && (
                    <Sources>
                      <SourcesTrigger count={sourceParts.length} />
                      {sourceParts.map((part, index) => (
                        <SourcesContent key={`${message.id}-source-${index}`}>
                          <Source href={part.url} title={part.url} />
                        </SourcesContent>
                      ))}
                    </Sources>
                  )}

                  {reasoningParts.map((part, index) => (
                    <Reasoning
                      className="w-full"
                      isStreaming={
                        status === "streaming" &&
                        index === message.parts.length - 1 &&
                        message.id === messages.at(-1)?.id
                      }
                      key={`${message.id}-reasoning-${index}`}
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
                                {status === "streaming" ||
                                status === "submitted" ? (
                                  <MessageAction
                                    label="Stop"
                                    onClick={() => stop()}
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
                  <Shimmer
                    as="p"
                    className="text-muted-foreground text-[11px]"
                  >
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
                  <div className="flex items-center gap-1 shrink-0">
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
                    textareaRef={textareaRef}
                    size="icon-xs"
                  />
                  <PromptInputSubmit
                    disabled={!(input || status)}
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
