import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // In production, consider lowering this or using tracesSampler.
  tracesSampleRate: Number.parseFloat(
    process.env.SENTRY_TRACES_SAMPLE_RATE ?? "1.0"
  ),
  enableLogs: true,
  integrations: [
    Sentry.consoleLoggingIntegration({
      levels: ["log", "warn", "error"],
    }),
  ],
});
