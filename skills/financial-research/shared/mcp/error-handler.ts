export function handleMCPError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function isRetryableError(error: unknown): boolean {
  const errorMsg = String(error).toLowerCase();
  return errorMsg.includes('timeout') ||
         errorMsg.includes('rate limit') ||
         errorMsg.includes('429');
}
