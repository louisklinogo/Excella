"use client";

import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  VoiceButton,
  type VoiceButtonState,
} from "@/components/ui/voice-button";

const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");

  const response = await fetch("/api/transcription", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(errorData.error || "Transcription failed");
  }

  const { transcription } = (await response.json()) as {
    transcription?: string;
  };

  if (!transcription) {
    throw new Error("No transcription received");
  }

  return transcription;
};

type VoiceInputButtonProps = {
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onTranscriptionChange?: (nextText: string) => void;
  getCurrentText?: () => string;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onAudioStreamChange?: (stream: MediaStream | null) => void;
  className?: string;
  icon?: ReactNode;
  size?: "icon-xs" | "icon-sm" | "icon" | "default";
};

export function VoiceInputButton({
  textareaRef,
  onTranscriptionChange,
  getCurrentText,
  onRecordingStateChange,
  onAudioStreamChange,
  className,
  icon,
  size = "icon-sm",
}: VoiceInputButtonProps) {
  const [state, setState] = useState<VoiceButtonState>("idle");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    onRecordingStateChange?.(state === "recording");
  }, [state, onRecordingStateChange]);

  useEffect(() => {
    onAudioStreamChange?.(audioStream);
  }, [audioStream, onAudioStreamChange]);

  const handleTranscription = useCallback(
    async (audioBlob: Blob) => {
      setState("processing");

      try {
        const transcription = await transcribeAudio(audioBlob);

        const currentBase = getCurrentText?.() ?? "";
        const nextText = currentBase
          ? `${currentBase.trimEnd()} ${transcription}`
          : transcription;

        if (textareaRef?.current) {
          const textarea = textareaRef.current;
          textarea.value = nextText;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }

        onTranscriptionChange?.(nextText);
        setState("success");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to transcribe audio";
        console.error("Transcription error:", error);
        toast.error(message);
        setState("error");
      } finally {
        window.setTimeout(() => {
          setState("idle");
          audioChunksRef.current = [];
          mediaRecorderRef.current = null;
        }, 1500);
      }
    },
    [getCurrentText, onTranscriptionChange, textareaRef]
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setAudioStream(stream);

      let options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options = { mimeType: "audio/webm;codecs=opus" };
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/webm" };
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        options = { mimeType: "audio/mp4" };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        setAudioStream(null);

        const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        await handleTranscription(audioBlob);
      };

      mediaRecorder.start();
      setState("recording");
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Failed to access microphone");
      setState("error");
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
    }
  }, [handleTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, [state]);

  const handlePress = useCallback(() => {
    if (state === "idle") {
      startRecording();
    } else if (state === "recording") {
      stopRecording();
    }
  }, [startRecording, stopRecording, state]);

  return (
    <VoiceButton
      className={className}
      icon={icon}
      onPress={handlePress}
      size={size}
      state={state}
    />
  );
}
