

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  normalized?: Record<string, unknown>;
}

export interface MCPClientConfig {
  serverCommand: string;
  serverArgs?: string[];
  env?: Record<string, string>;
}

export class MCPClientWrapper {
  private toolCallCounts: Map<string, number> = new Map();
  private rateLimitErrors: Set<string> = new Set();

  constructor(private config: MCPClientConfig) {}

  async invokeTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const callCount = (this.toolCallCounts.get(name) || 0) + 1;
    this.toolCallCounts.set(name, callCount);

    try {
      const response = await fetch('http://localhost:3000/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
      });

      const result = await response.json();

      if (this.isRateLimitError(result)) {
        this.rateLimitErrors.add(name);
        return {
          success: false,
          data: null,
          error: 'Rate limit exceeded for tool: ' + name
        };
      }

      const normalized = this.normalizeResponse(result);

      return {
        success: true,
        data: result,
        normalized
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private isRateLimitError(result: unknown): boolean {
    if (typeof result !== 'object' || result === null) {
      return false;
    }

    const errorText = JSON.stringify(result).toLowerCase();
    return errorText.includes('rate limit') ||
           errorText.includes('too many requests') ||
           errorText.includes('429');
  }

  private normalizeResponse(result: unknown): Record<string, unknown> {
    if (typeof result !== 'object' || result === null) {
      return {};
    }

    const obj = result as Record<string, unknown>;

    if (Array.isArray(obj.content)) {
      const textContent = obj.content
        .filter((item: unknown) => typeof item === 'object' && item !== null && (item as any).type === 'text')
        .map((item: unknown) => (item as any).text)
        .join('\n');

      try {
        return JSON.parse(textContent);
      } catch {
        return { raw: textContent };
      }
    }

    return obj;
  }

  getToolStats(name: string): { calls: number; rateLimited: boolean } {
    return {
      calls: this.toolCallCounts.get(name) || 0,
      rateLimited: this.rateLimitErrors.has(name)
    };
  }

  resetRateLimits(): void {
    this.rateLimitErrors.clear();
  }

  async disconnect(): Promise<void> {
  }
}

export class MCPConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPConnectionError';
  }
}
