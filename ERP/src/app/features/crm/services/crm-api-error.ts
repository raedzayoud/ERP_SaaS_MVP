import { HttpErrorResponse } from '@angular/common/http';

/** Builds an error carrying the machine code returned by the API. */
export function crmCode(code: string, message = code): Error {
  const failure = new Error(message) as Error & { code: string };
  failure.code = code;
  return failure;
}

/**
 * Turns a failed call into an error the pages can translate: the API error
 * code becomes `error.code`, anything else falls back to the page message.
 */
export function crmError(error: unknown): Error {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { code?: string; message?: string } | null;
    if (body?.code) {
      return crmCode(body.code, body.message ?? body.code);
    }
    return new Error(body?.message ?? error.message);
  }
  return error instanceof Error ? error : new Error('request failed');
}
