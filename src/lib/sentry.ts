import * as Sentry from '@sentry/nextjs';

let initialized = false;

/**
 * Initializes Sentry error reporting.
 * Safe to call multiple times — only initializes once.
 * Requires SENTRY_DSN env variable to be set.
 */
export function initSentry() {
  if (initialized || (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN)) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0',

    // Capture 100% of transactions in dev, 10% in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Ignore common non-actionable errors
    ignoreErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'AbortError',
      /^Network request failed/
    ],

    beforeSend(event, hint) {
      // Strip sensitive auth headers from breadcrumbs before sending to Sentry
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    }
  });

  initialized = true;
}

/**
 * Captures an exception in Sentry with extra structured context.
 */
export function captureError(
  error: unknown,
  context?: { userId?: string; route?: string; extra?: Record<string, unknown> }
) {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  initSentry();

  Sentry.withScope(scope => {
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.route) scope.setTag('route', context.route);
    if (context?.extra) scope.setExtras(context.extra);
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}

export { Sentry };
