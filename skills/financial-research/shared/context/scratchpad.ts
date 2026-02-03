export interface ToolCall {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  summary?: string;
  timestamp: number;
  error?: string;
}

export class Scratchpad {
  private toolCalls: ToolCall[] = [];
  private summaries: string[] = [];

  addToolCall(toolName: string, args: Record<string, unknown>, result: unknown, summary?: string): void {
    this.toolCalls.push({
      toolName,
      args,
      result,
      summary,
      timestamp: Date.now()
    });
  }

  addToolError(toolName: string, args: Record<string, unknown>, error: string): void {
    this.toolCalls.push({
      toolName,
      args,
      result: null,
      error,
      timestamp: Date.now()
    });
  }

  addSummary(summary: string): void {
    this.summaries.push(summary);
  }

  getToolCalls(): ToolCall[] {
    return [...this.toolCalls];
  }

  getSummaries(): string[] {
    return [...this.summaries];
  }

  hasExecutedTool(toolName: string): boolean {
    return this.toolCalls.some(call => call.toolName === toolName && !call.error);
  }

  formatForPrompt(): string {
    if (this.toolCalls.length === 0) {
      return 'No tool calls executed.';
    }

    return this.toolCalls
      .filter(call => !call.error)
      .map(call => {
        const summary = call.summary || `Called ${call.toolName}`;
        return `- ${summary}`;
      })
      .join('\n');
  }
}
