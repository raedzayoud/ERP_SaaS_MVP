import { HttpErrorResponse } from '@angular/common/http';

export interface ApiErrorBody {
  code?: string;
  message?: string;
}

/** Reads the JSON body sent by the API when a call fails. */
export function apiErrorBody(error: unknown): ApiErrorBody | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body = error.error;
  return body && typeof body === 'object' ? (body as ApiErrorBody) : null;
}

/** Machine code returned by the API, when there is one. */
export function apiErrorCode(error: unknown): string | null {
  return apiErrorBody(error)?.code ?? null;
}

/** Builds an error carrying the machine code returned by the API. */
export function apiCodeError(code: string, message = code): Error {
  const failure = new Error(message) as Error & { code: string };
  failure.code = code;
  return failure;
}
