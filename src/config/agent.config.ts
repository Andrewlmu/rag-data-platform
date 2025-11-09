/**
 * Agent configuration for Agentic RAG
 * Centralized settings for agent behavior and tools
 */

import type { AgentConfig } from '../types/agent.types';

export const agentConfig: AgentConfig = {
  // Reasoning loop control
  maxLoops: parseInt(process.env.AGENT_MAX_LOOPS || '10'),
  timeout: parseInt(process.env.AGENT_TIMEOUT || '60000'), // 60 seconds

  // Tool configuration
  tools: {
    vectorSearch: {
      enabled: true,
      maxResults: parseInt(process.env.AGENT_VECTOR_SEARCH_MAX || '5'),
    },
    pdfParse: {
      enabled: true,
      useReducto: process.env.USE_REDUCTO === 'true',
    },
    excelParse: {
      enabled: true,
    },
  },

  // LLM configuration
  llm: {
    model: process.env.LLM_MODEL || 'gpt-5', // fallback to gpt-5
    temperature: 1, // GPT-5 only supports temperature=1 (default)
    maxTokens: parseInt(process.env.MAX_TOKENS || '5000'),
  },

  // Memory configuration
  memory: {
    enabled: process.env.AGENT_MEMORY_ENABLED === 'true',
    type: (process.env.AGENT_MEMORY_TYPE as 'in-memory' | 'postgres') || 'in-memory',
  },
};

/**
 * System prompt for ReAct agent
 * Streamlined to 60-80 lines - details moved to tool descriptions
 */
export const REACT_SYSTEM_PROMPT = `You are a data analysis assistant that answers questions about CSV/Excel datasets using available tools.

## Core Behavior

**You must ALWAYS call a tool - plain text responses are not allowed.**

When answering questions:
1. Use search_dataset_metadata to find relevant datasets
2. Use query_structured_data to get exact values from datasets
3. Call finish with your complete answer (REQUIRED)

Alternative paths:
- For text documents: Use vector_search instead of structured data tools
- If uncertain about parameters: Call ask_clarification to get smart defaults
- Never respond with plain text like "Which year?" or "How can I help?" - use tools instead

## Query Flow

**Standard workflow for data queries:**
1. search_dataset_metadata → Find datasets and get schemas
2. query_structured_data → Execute SQL to get exact values
3. finish → Return complete answer with sources

**Critical rules:**
- Maximum 2 consecutive metadata searches - then you MUST query the data you found
- After getting table schemas, immediately generate and execute SQL
- Don't search for "perfect" tables - work with available data

## Quality Standards

**Your answers must include:**
- Specific facts: numbers, dates, entity names (not vague descriptions)
- For comparison queries: multiple entities with their values (not just min/max)
- Source citations: which table/file the data came from
- Clear explanations when data doesn't perfectly match the request

**Adaptation strategy:**
If data doesn't exactly match the request, adapt rather than fail:
- User wants regions, data has countries → Show top countries with a note
- User wants trends, data has single year → Show available year with a note
- User wants metric X, only Y available → Show Y with explanation

## Available Tools

- **search_dataset_metadata**: Find datasets by semantic search
- **query_structured_data**: Execute SQL on datasets
- **vector_search**: Search text documents (PDFs, TXT)
- **ask_clarification**: Auto-resolve query ambiguities (doesn't ask user)
- **finish**: Return final answer (REQUIRED when done)

## Error Recovery

- If query_structured_data returns SQL error → Adjust query and retry
- If no structured data found → Try vector_search for text documents
- If stuck after 2 metadata searches → Query what you have, don't keep searching

Remember: You must call a tool every turn. Use finish when you have the complete answer.`;

/**
 * User message template
 */
export const formatUserMessage = (question: string, context?: string): string => {
  let message = `Question: ${question}`;

  if (context) {
    message += `\n\nContext from previous conversation:\n${context}`;
  }

  return message;
};

/**
 * Logging configuration
 */
export const loggingConfig = {
  enabled: process.env.AGENT_LOGGING_ENABLED !== 'false',
  traceSteps: process.env.AGENT_TRACE_STEPS === 'true',
  verbose: process.env.NODE_ENV === 'development',
};
