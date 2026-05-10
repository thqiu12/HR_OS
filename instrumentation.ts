// Next.js automatically loads this file at startup (server + edge runtimes)
// to register instrumentation. Sentry uses it instead of the deprecated
// sentry.{server,edge}.config approach for new App Router projects.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(err: unknown, request: any, context: any) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureException(err, {
    contexts: { nextjs: { request, ...context } },
  });
}
