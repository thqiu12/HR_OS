/**
 * Thin Sentry wrapper that no-ops when DSN unset.
 *
 * Use `captureError(err, ctx)` instead of importing @sentry/nextjs directly
 * so the rest of the app stays decoupled from Sentry's API and can run
 * without any DSN configured.
 */

let sentryModule: any = null;
async function getSentry() {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return null;
  if (sentryModule) return sentryModule;
  try {
    sentryModule = await import("@sentry/nextjs");
    return sentryModule;
  } catch {
    return null;
  }
}

export async function captureError(err: unknown, context?: Record<string, any>) {
  const s = await getSentry();
  if (!s) {
    // Always print server-side errors so dev never loses them
    console.error("[error]", err, context);
    return;
  }
  s.captureException(err, { extra: context });
}

export async function captureMessage(message: string, level: "info" | "warning" | "error" = "info", context?: Record<string, any>) {
  const s = await getSentry();
  if (!s) {
    console.log(`[${level}] ${message}`, context);
    return;
  }
  s.captureMessage(message, { level, extra: context });
}

/** Wraps a server action so any thrown error is captured before re-throwing. */
export function withSentry<TArgs extends any[], TReturn>(
  name: string,
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (err) {
      await captureError(err, { action: name });
      throw err;
    }
  };
}
