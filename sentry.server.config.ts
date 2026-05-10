import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    // Don't ship PII — we audit-log PII access separately on our own terms
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip request.cookies entirely (may contain session tokens)
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });
}
