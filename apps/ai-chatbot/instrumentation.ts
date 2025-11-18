import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({ serviceName: "ai-chatbot" });
  (
    globalThis as unknown as { ___MASTRA_TELEMETRY___?: boolean }
  ).___MASTRA_TELEMETRY___ = true;
}
