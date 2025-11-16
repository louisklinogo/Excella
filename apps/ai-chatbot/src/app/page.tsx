"use client";

import { useChat } from "@ai-sdk/react";
import { CopyIcon, GlobeIcon, RefreshCcwIcon } from "lucide-react";
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
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { VoiceInputButton } from "@/components/ai-elements/voice-input-button";
import { LiveWaveform } from "@/components/ui/live-waveform";

const models = [
  {
    name: "OpenAI — GPT 4o",
    value: "openai/gpt-4o",
  },
  {
    name: "Gemini 2.5 Pro",
    value: "google/gemini-2.5-pro",
  },
  {
    name: "Anthropic — Claude Sonnet 4.5",
    value: "anthropic/claude-sonnet-4-5",
  },
];

const ChatBotDemo = () => {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(models[0].value);
  const [webSearch, setWebSearch] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [messageBranches, setMessageBranches] = useState<
    Record<string, string[]>
  >({});
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { messages, sendMessage, status, regenerate } = useChat();

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
        [branchGroupId]: [
          ...existingBranches,
          lastAssistantTextPart.text,
        ],
      };
    });

    await regenerate();
  };

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    sendMessage(
      {
        text: message.text || "Sent with attachments",
        files: message.files,
      },
      {
        body: {
          model,
          webSearch,
        },
      }
    );
    setInput("");
  };

  return (
    <div className="relative mx-auto size-full h-screen max-w-4xl p-6">
      <div className="flex h-full flex-col">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => {
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
                <div key={message.id}>
                  {isAssistant && sourceParts.length > 0 && (
                    <Sources>
                      <SourcesTrigger count={sourceParts.length} />
                      {sourceParts.map((part, index) => (
                        <SourcesContent key={`${message.id}-source-${index}`}>
                          <Source
                            href={part.url}
                            title={part.url}
                          />
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
                              <MessageActions>
                                <MessageBranchSelector from={message.role}>
                                  <MessageBranchPrevious />
                                  <MessageBranchPage />
                                  <MessageBranchNext />
                                </MessageBranchSelector>
                                <MessageAction
                                  label="Retry"
                                  onClick={handleRegenerateLast}
                                >
                                  <RefreshCcwIcon className="size-3" />
                                </MessageAction>
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
            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput
          className="mt-4"
          globalDrop
          multiple
          onSubmit={handleSubmit}
        >
          <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader>
          <PromptInputBody>
            {isRecording && audioStream ? (
              <div className="flex h-[64px] w-full items-center justify-center px-6">
                <LiveWaveform
                  audioStream={audioStream}
                  barCount={120}
                  className="w-full"
                  maxHeight={40}
                  minHeight={12}
                />
              </div>
            ) : (
              <PromptInputTextarea
                onChange={(e) => setInput(e.target.value)}
                ref={textareaRef}
                value={input}
              />
            )}
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <VoiceInputButton
                getCurrentText={() => input}
                onAudioStreamChange={setAudioStream}
                onRecordingStateChange={setIsRecording}
                onTranscriptionChange={setInput}
                textareaRef={textareaRef}
              />
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputButton
                onClick={() => setWebSearch(!webSearch)}
                variant={webSearch ? "default" : "ghost"}
              >
                <GlobeIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
              <PromptInputSelect
                onValueChange={(value) => {
                  setModel(value);
                }}
                value={model}
              >
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {models.map((option) => (
                    <PromptInputSelectItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.name}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
            <PromptInputSubmit disabled={!(input || status)} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

export default ChatBotDemo;
