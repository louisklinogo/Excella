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

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, 30_000);

  let response: Response;

  try {
    response = await fetch("/api/transcription", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Transcription timed out. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

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
  /** Optional listener for full state changes (idle/recording/processing/...) */
  onStateChange?: (state: VoiceButtonState) => void;
  onTranscriptionStatusChange?: (
    status: "idle" | "processing" | "success" | "error"
  ) => void;
  /**
   * When provided, exposes recording controls (start/confirm/cancel) to the parent.
   * Useful when the trigger UI lives outside of this component.
   */
  onControlsReady?: (controls: {
    start: () => void;
    confirm: () => void;
    cancel: () => void;
  }) => void;
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
  onStateChange,
  onTranscriptionStatusChange,
  onControlsReady,
  className,
  icon,
  size = "icon-sm",
}: VoiceInputButtonProps) {
  const [state, setState] = useState<VoiceButtonState>("idle");
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const stopModeRef = useRef<"confirm" | "cancel">("confirm");

  useEffect(() => {
    onRecordingStateChange?.(state === "recording");
  }, [state, onRecordingStateChange]);

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  useEffect(() => {
    onAudioStreamChange?.(audioStream);
  }, [audioStream, onAudioStreamChange]);

  const handleTranscription = useCallback(
    async (audioBlob: Blob) => {
      setState("processing");
      onTranscriptionStatusChange?.("processing");

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
        onTranscriptionStatusChange?.("success");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to transcribe audio";
        console.error("Transcription error:", error);
        toast.error(message);
        setState("error");
        onTranscriptionStatusChange?.("error");
      } finally {
        window.setTimeout(() => {
          setState("idle");
          audioChunksRef.current = [];
          mediaRecorderRef.current = null;
          onTranscriptionStatusChange?.("idle");
        }, 1500);
      }
    },
    [getCurrentText, onTranscriptionChange, onTranscriptionStatusChange, textareaRef]
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

        if (stopModeRef.current === "confirm") {
          await handleTranscription(audioBlob);
        } else {
          // Cancelled: reset without transcribing
          setState("idle");
          audioChunksRef.current = [];
          mediaRecorderRef.current = null;
        }
      };

      mediaRecorder.start();
      setState("recording");
      stopModeRef.current = "confirm";
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

  const cancelRecording = useCallback(() => {
    stopModeRef.current = "cancel";
    stopRecording();
  }, [stopRecording]);

  const confirmRecording = useCallback(() => {
    stopModeRef.current = "confirm";
    stopRecording();
  }, [stopRecording]);

  // Expose imperative controls to the parent when requested
  useEffect(() => {
    if (!onControlsReady) return;

    onControlsReady({
      start: startRecording,
      confirm: confirmRecording,
      cancel: cancelRecording,
    });
  }, [cancelRecording, confirmRecording, onControlsReady, startRecording]);

  const handlePress = useCallback(() => {
    if (state === "idle") {
      startRecording();
    }
  }, [startRecording, state]);

  // While recording/processing we render custom controls elsewhere (waveform bar),
  // so hide the default voice button.
  if (state === "recording" || state === "processing") {
    return null;
  }

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
