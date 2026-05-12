// lib/utils/cost-tracking.ts
// API cost calculation and tracking utilities

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cacheCreationCost: number;
  cacheReadCost: number;
  totalCost: number;
}

/**
 * Calculate cost for Anthropic API usage
 * Pricing as of May 2026 for Claude Sonnet 4
 */
export function calculateAnthropicCost(usage: TokenUsage): CostBreakdown {
  // Claude Sonnet 4 pricing (per million tokens)
  const PRICING = {
    input: 3.00,           // $3 per million input tokens
    output: 15.00,         // $15 per million output tokens
    cacheWrite: 3.75,      // $3.75 per million cache write tokens
    cacheRead: 0.30,       // $0.30 per million cache read tokens
  };

  const inputCost = (usage.input_tokens / 1_000_000) * PRICING.input;
  const outputCost = (usage.output_tokens / 1_000_000) * PRICING.output;
  const cacheCreationCost = ((usage.cache_creation_tokens || 0) / 1_000_000) * PRICING.cacheWrite;
  const cacheReadCost = ((usage.cache_read_tokens || 0) / 1_000_000) * PRICING.cacheRead;

  return {
    inputCost,
    outputCost,
    cacheCreationCost,
    cacheReadCost,
    totalCost: inputCost + outputCost + cacheCreationCost + cacheReadCost,
  };
}

/**
 * Format cost breakdown as human-readable string
 */
export function formatCostBreakdown(cost: CostBreakdown): string {
  const lines = [
    `Input: $${cost.inputCost.toFixed(4)}`,
    `Output: $${cost.outputCost.toFixed(4)}`,
  ];

  if (cost.cacheCreationCost > 0) {
    lines.push(`Cache Write: $${cost.cacheCreationCost.toFixed(4)}`);
  }

  if (cost.cacheReadCost > 0) {
    lines.push(`Cache Read: $${cost.cacheReadCost.toFixed(4)}`);
  }

  lines.push(`Total: $${cost.totalCost.toFixed(4)}`);

  return lines.join('\n');
}

/**
 * Check if cost exceeds expected threshold
 */
export function isCostUnusual(cost: CostBreakdown, threshold: number = 0.50): boolean {
  return cost.totalCost > threshold;
}

/**
 * Estimate cost for a given number of tokens
 */
export function estimateCost(inputTokens: number, outputTokens: number): number {
  return calculateAnthropicCost({
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  }).totalCost;
}
