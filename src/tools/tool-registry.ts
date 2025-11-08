/**
 * Tool Registry for Agentic RAG
 * Centralized management of all tools available to the agent
 */

import type { AgentTool } from '../types/agent.types';
import { agentConfig, loggingConfig } from '../config/agent.config';

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();
  private stats: Map<string, { calls: number; successes: number; failures: number }> = new Map();

  /**
   * Register a tool
   */
  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }

    this.tools.set(tool.name, tool);
    this.stats.set(tool.name, { calls: 0, successes: 0, failures: 0 });

    if (loggingConfig.verbose) {
      console.log(`🔧 Tool registered: ${tool.name}`);
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a tool with error handling and stats tracking
   */
  async execute(
    toolName: string,
    args: Record<string, any>
  ): Promise<{ result: any; error?: string }> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      const error = `Tool '${toolName}' not found`;
      console.error(`❌ ${error}`);
      return { result: null, error };
    }

    const stats = this.stats.get(toolName)!;
    stats.calls++;

    const startTime = Date.now();

    try {
      if (loggingConfig.traceSteps) {
        console.log(`🔧 Executing tool: ${toolName}`, { args });
      }

      const result = await this.executeWithTimeout(tool, args);

      stats.successes++;

      if (loggingConfig.traceSteps) {
        const duration = Date.now() - startTime;
        console.log(`✅ Tool ${toolName} succeeded in ${duration}ms`);
      }

      return { result };
    } catch (error: any) {
      stats.failures++;

      const duration = Date.now() - startTime;
      console.error(`❌ Tool ${toolName} failed after ${duration}ms:`, error.message);

      return {
        result: null,
        error: `Tool execution failed: ${error.message}`,
      };
    }
  }

  /**
   * Execute tool with timeout
   */
  private async executeWithTimeout(tool: AgentTool, args: Record<string, any>): Promise<any> {
    const timeoutMs = agentConfig.timeout;

    return Promise.race([
      tool.function(args),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Get tool execution statistics
   */
  getStats(toolName?: string): any {
    if (toolName) {
      return this.stats.get(toolName) || null;
    }

    const allStats: Record<string, any> = {};
    for (const [name, stats] of this.stats.entries()) {
      allStats[name] = {
        ...stats,
        successRate:
          stats.calls > 0 ? ((stats.successes / stats.calls) * 100).toFixed(1) + '%' : 'N/A',
      };
    }
    return allStats;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    for (const stats of this.stats.values()) {
      stats.calls = 0;
      stats.successes = 0;
      stats.failures = 0;
    }
  }

  /**
   * Get tool definitions in OpenAI Responses API format
   * Responses API requires type field plus flat name/description/parameters
   */
  getOpenAITools(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function' as const,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Validate tool arguments against schema
   */
  validateArgs(toolName: string, args: Record<string, any>): { valid: boolean; error?: string } {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return { valid: false, error: `Tool '${toolName}' not found` };
    }

    const required = tool.parameters.required || [];

    for (const param of required) {
      if (!(param in args)) {
        return {
          valid: false,
          error: `Missing required parameter '${param}' for tool '${toolName}'`,
        };
      }
    }

    return { valid: true };
  }
}

// Global tool registry instance
export const toolRegistry = new ToolRegistry();
