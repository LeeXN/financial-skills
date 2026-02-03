const TOKEN_BUDGET = 120000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function checkBudget(currentTokens: number): boolean {
  return currentTokens < TOKEN_BUDGET;
}

export function getRemainingBudget(currentTokens: number): number {
  return Math.max(0, TOKEN_BUDGET - currentTokens);
}

export function shouldCompact(currentTokens: number): boolean {
  const threshold = TOKEN_BUDGET * 0.7;
  return currentTokens >= threshold;
}
