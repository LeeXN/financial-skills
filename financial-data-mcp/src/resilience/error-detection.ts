export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  
  const message = error.message.toLowerCase();
  
  if (message.includes('429')) return true;
  if (message.includes('rate limit')) return true;
  if (message.includes('rate-limit')) return true;
  if (message.includes('ratelimit')) return true;
  if (message.includes('too many requests')) return true;
  if (message.includes('quota exceeded')) return true;
  if (message.includes('api limit')) return true;
  if (message.includes('throttl')) return true;
  
  return false;
}

export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  
  const message = error.message.toLowerCase();
  
  if (message.includes('500')) return true;
  if (message.includes('502')) return true;
  if (message.includes('503')) return true;
  if (message.includes('504')) return true;
  if (message.includes('timeout')) return true;
  if (message.includes('econnreset')) return true;
  if (message.includes('econnrefused')) return true;
  if (message.includes('network')) return true;
  
  return false;
}

export function shouldRetryWithDifferentKey(error: unknown): boolean {
  return isRateLimitError(error);
}

export function shouldFailoverToNextSource(error: unknown): boolean {
  return isRateLimitError(error) || isTransientError(error) || error instanceof Error;
}
