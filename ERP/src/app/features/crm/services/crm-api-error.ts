import { apiCodeError, apiErrorBody } from '../../../core/services/api-error';

export { apiCodeError as crmCode };

/**
 * Turns a failed call into an error the pages can translate: the API error
 * code becomes `error.code`, anything else falls back to the page message.
 */
export function crmError(error: unknown): Error {
  const body = apiErrorBody(error);
  if (body?.code) {
    return apiCodeError(body.code, body.message ?? body.code);
  }
  if (body?.message) {
    return new Error(body.message);
  }
  return error instanceof Error ? error : new Error('request failed');
}
