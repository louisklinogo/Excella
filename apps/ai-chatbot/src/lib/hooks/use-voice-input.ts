"use client";

import { useRef, useState } from "react";

export type VoiceControls = {
  start: () => void;
  confirm: () => void;
  cancel: () => void;
};

export type UseVoiceInputResult = {
  voiceControlsRef: React.MutableRefObject<VoiceControls | null>;
  audioStream: MediaStream | null;
  setAudioStream: (stream: MediaStream | null) => void;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  isTranscribing: boolean;
  setIsTranscribing: (value: boolean) => void;
  isVoiceActive: boolean;
};

export const useVoiceInput = (): UseVoiceInputResult => {
  const voiceControlsRef = useRef<VoiceControls | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const isVoiceActive = isRecording || isTranscribing;

  return {
    voiceControlsRef,
    audioStream,
    setAudioStream,
    isRecording,
    setIsRecording,
    isTranscribing,
    setIsTranscribing,
    isVoiceActive,
  };
};
