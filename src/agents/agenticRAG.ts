/**
 * AgenticRAG - Main controller for agentic RAG system
 * Coordinates ReAct agent, tools, and services
 */

import { ReactAgent } from './react-agent';
import { VectorSearch } from '../services/vectorSearch';
import { ParentChildRetriever } from '../services/parentChildRetriever';
import { toolRegistry } from '../tools/tool-registry';
import { createVectorSearchTool } from '../tools/vector-search-tool';
import { createFinishTool } from '../tools/finish-tool';
import type { AgenticQueryResult } from '../types/agent.types';
import { agentConfig } from '../config/agent.config';

export class AgenticRAG {
  private agent: ReactAgent;
  private vectorSearch: VectorSearch;
  private parentChildRetriever: ParentChildRetriever | null = null;
  private initialized: boolean = false;

  constructor(vectorSearch: VectorSearch, parentChildRetriever?: ParentChildRetriever) {
    this.vectorSearch = vectorSearch;
    this.parentChildRetriever = parentChildRetriever || null;
    this.agent = new ReactAgent();
  }

  /**
   * Initialize tools and register them
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('🚀 Initializing Agentic RAG...');

    // Register tools
    if (agentConfig.tools.vectorSearch.enabled) {
      const vectorSearchTool = createVectorSearchTool(
        this.vectorSearch,
        this.parentChildRetriever || undefined
      );
      toolRegistry.register(vectorSearchTool);
      console.log(
        `  ✅ Vector search tool registered${this.parentChildRetriever ? ' (hierarchical)' : ''}`
      );
    }

    // Register finish tool (required for ReAct)
    const finishTool = createFinishTool();
    toolRegistry.register(finishTool);
    console.log('  ✅ Finish tool registered');

    // Log available tools
    const tools = toolRegistry.getAll();
    console.log(`\n🔧 Available tools: ${tools.map(t => t.name).join(', ')}`);

    this.initialized = true;
    console.log('✅ Agentic RAG initialized\n');
  }

  /**
   * Query the agentic RAG system
   */
  async query(question: string): Promise<AgenticQueryResult> {
    // Ensure initialization
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate question
    if (!question || question.trim().length === 0) {
      throw new Error('Question cannot be empty');
    }

    // Execute agent
    const result = await this.agent.query(question);

    return result;
  }

  /**
   * Get tool usage statistics
   */
  getToolStats() {
    return toolRegistry.getStats();
  }

  /**
   * Reset tool statistics
   */
  resetStats() {
    toolRegistry.resetStats();
  }

  /**
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
