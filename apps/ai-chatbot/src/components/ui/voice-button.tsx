"use client";

import { CheckIcon, Loader2Icon, MicIcon, XIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VoiceButtonState =
  | "idle"
  | "recording"
  | "processing"
  | "success"
  | "error";

export interface VoiceButtonProps
  extends Omit<ComponentProps<typeof Button>, "onClick" | "children"> {
  state?: VoiceButtonState;
  onPress?: () => void;
  label?: ReactNode;
  trailing?: ReactNode;
  icon?: ReactNode;
}

export function VoiceButton({
  state = "idle",
  onPress,
  label,
  trailing,
  icon,
  variant = "outline",
  size = "icon-sm",
  className,
  disabled,
  ...props
}: VoiceButtonProps) {
  const getStateIcon = () => {
    if (state === "recording") {
      return icon ?? <MicIcon className="size-4 animate-pulse" />;
    }
    if (state === "processing") {
      return <Loader2Icon className="size-4 animate-spin" />;
    }
    if (state === "success") {
      return <CheckIcon className="size-4" />;
    }
    if (state === "error") {
      return <XIcon className="size-4" />;
    }
    return icon ?? <MicIcon className="size-4" />;
  };

  const isIconOnly = size?.toString().startsWith("icon") && !label && !trailing;

  return (
    <Button
      aria-label={isIconOnly ? `Voice input – ${state}` : undefined}
      className={cn(
        "transition-all",
        state === "recording" && "bg-accent text-accent-foreground",
        state === "success" && "bg-emerald-100 dark:bg-emerald-900/30",
        state === "error" && "bg-red-100 dark:bg-red-900/30",
        className
      )}
      disabled={disabled || state === "processing"}
      onClick={onPress}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {isIconOnly ? (
        getStateIcon()
      ) : (
        <>
          {label && <span className="flex-1 text-left text-sm">{label}</span>}
          <span className="flex items-center justify-center">
            {getStateIcon()}
          </span>
          {trailing && (
            <span className="text-muted-foreground text-xs opacity-70">
              {trailing}
            </span>
          )}
        </>
      )}
    </Button>
  );
}
