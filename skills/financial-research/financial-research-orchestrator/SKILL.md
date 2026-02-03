---
name: financial-research-orchestrator
description: Multi-step financial research planning and execution with context tracking
version: 1.0.0
license: MIT
metadata:
  author: Financial Skills Team
  category: financial-research
  compatibility:
    opencode: ^1.0.0
    claude-code: ^1.0.0
  dependencies:
    mcp: financial-data-mcp
    sdk: @modelcontextprotocol/sdk
  capabilities:
    - Query planning and workflow generation
    - Multi-step tool orchestration
    - Context accumulation and summarization
    - Graceful exit with partial data
    - Rate limit awareness
    - Progress event emission
---

This skill orchestrates financial research workflows by:

1. **Planning**: Analyzes user queries and identifies required data steps
2. **Execution**: Executes planned steps through MCP tools with error handling
3. **Context Management**: Tracks tool calls, results, and reasoning across steps
4. **Graceful Exit**: Generates useful answers even with incomplete data
5. **Progress Visibility**: Emits events for real-time status updates

## Usage

Provide natural language queries like:
- "Compare Apple and Microsoft's performance over 3 quarters"
- "Analyze NVIDIA's revenue trend over the last year"
- "What's driving Tesla's stock sentiment this week?"

The skill will plan the required research steps, execute them, and synthesize findings into comprehensive insights.

## Integration

Requires `financial-data-mcp` MCP server running to provide:
- get_stock_quote
- get_stock_price_history
- get_financials
- get_company_info
- get_news
- get_technical_indicator
