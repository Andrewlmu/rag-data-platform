/**
 * ReAct Agent - Reasoning + Acting pattern with LangGraph
 * Autonomous agent that uses tools to answer questions
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import OpenAI from 'openai';
import { BaseMessage, HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import type { AgentState, AgenticQueryResult, Source } from '../types/agent.types';
import { agentConfig, REACT_SYSTEM_PROMPT, loggingConfig } from '../config/agent.config';
import { toolRegistry } from '../tools/tool-registry';

/**
 * StateGraph annotation for agent state
 */
const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  question: Annotation<string>(),
  answer: Annotation<string | null>(),
  loopCount: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  error: Annotation<string | null>(),
  consecutiveSearchCalls: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
});

/**
 * ReAct Agent using LangGraph
 */
export class ReactAgent {
  private openai: OpenAI;
  private graph: any;
  private callIdMap: Map<string, string> = new Map(); // Maps LangChain IDs to Responses API IDs

  constructor() {
    console.log('🔍 AgentConfig.llm.model:', agentConfig.llm.model);
    console.log('🔍 process.env.LLM_MODEL:', process.env.LLM_MODEL);

    // Initialize OpenAI client for Responses API (GPT-5 support)
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build the graph
    this.graph = this.buildGraph();

    console.log(`🤖 ReAct Agent initialized with Responses API (model: ${agentConfig.llm.model})`);
  }

  /**
   * Get OpenAI client for tool access
   */
  getOpenAIClient(): OpenAI {
    return this.openai;
  }

  /**
   * Convert LangChain call ID to Responses API format
   * Responses API requires IDs to start with 'fc'
   */
  private convertCallId(langchainId: string): string {
    if (!this.callIdMap.has(langchainId)) {
      // Generate a new fc-prefixed ID
      const fcId = `fc_${Math.random().toString(36).substring(2, 15)}`;
      this.callIdMap.set(langchainId, fcId);
    }
    return this.callIdMap.get(langchainId)!;
  }

  /**
   * Build LangGraph for ReAct pattern
   */
  private buildGraph() {
    const workflow = new StateGraph(StateAnnotation)
      // Add nodes
      .addNode('llm', this.llmNode.bind(this))
      .addNode('tools', this.toolsNode.bind(this))
      .addNode('router', this.routerNode.bind(this))

      // Start with LLM
      .addEdge(START, 'llm')

      // After LLM, check if should use tools
      .addConditionalEdges('llm', this.shouldUseTool.bind(this), {
        useTool: 'tools',  // Has tool calls, execute them
        finish: END,       // No tool calls (shouldn't happen with tool_choice='required')
      })

      // After tools, go to router
      .addEdge('tools', 'router')

      // Router decides: continue or end
      .addConditionalEdges('router', this.shouldContinue.bind(this), {
        continue: 'llm',
        end: END,
      });

    // Compile the workflow with increased recursion limit
    // @ts-ignore - recursionLimit exists at runtime but may not be in types
    return workflow.compile({
      recursionLimit: 50, // Allow up to 50 loops for complex multi-step queries
    });
  }

  /**
   * LLM Node - Agent reasoning
   */
  private async llmNode(state: typeof StateAnnotation.State) {
    // ALWAYS log (ignore traceSteps for debugging)
    console.log(`\n🧠 LLM Node (Loop ${state.loopCount + 1}/${agentConfig.maxLoops})`);
    console.log(`🔍 traceSteps: ${loggingConfig.traceSteps}`);

    try {
      // Get available tools in OpenAI format
      const tools = toolRegistry.getOpenAITools();
      console.log(`🔍 tools.length: ${tools.length}`);

      // Build messages
      const messages: BaseMessage[] = [
        new HumanMessage({
          content: REACT_SYSTEM_PROMPT,
        }),
        ...state.messages,
      ];

      // If this is the first call, add the question
      if (state.loopCount === 0) {
        messages.push(
          new HumanMessage({
            content: `Question: ${state.question}`,
          })
        );
      }

      // Call LLM with tools using Responses API
      console.log(`🔍 Calling Responses API with ${messages.length} messages and ${tools.length} tools...`);
      console.log(`🔍 Messages being sent:`);
      messages.forEach((msg, i) => {
        const content = msg.content?.toString() || '[no content]';
        console.log(`  ${i + 1}. ${msg._getType()}: ${content.substring(0, 100)}...`);
      });
      console.log(`🔍 Tools being sent:`, JSON.stringify(tools, null, 2).substring(0, 500));

      // Convert LangChain messages to Responses API input format
      const responsesInput: any[] = [];

      // Separate system messages for instructions parameter
      let systemInstructions = REACT_SYSTEM_PROMPT;

      for (const msg of messages) {
        if (msg instanceof HumanMessage) {
          // Skip the first system prompt message since we use instructions parameter
          if (msg.content.toString() === REACT_SYSTEM_PROMPT) {
            continue;
          }
          responsesInput.push({
            role: 'user',
            content: msg.content.toString(),
            type: 'message'
          });
        } else if (msg instanceof AIMessage) {
          // If AIMessage has tool calls, add them as function_call items
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            for (const tc of msg.tool_calls) {
              // Convert LangChain ID to Responses API format
              const fcId = this.convertCallId(tc.id!);
              responsesInput.push({
                id: fcId,
                call_id: fcId,
                name: tc.name,
                arguments: JSON.stringify(tc.args),
                type: 'function_call'
              });
            }
          } else if (msg.content) {
            // Regular assistant message
            responsesInput.push({
              role: 'assistant',
              content: msg.content.toString(),
              type: 'message'
            });
          }
        } else if (msg instanceof ToolMessage) {
          // Tool output - convert LangChain ID to Responses API format
          const fcId = this.convertCallId(msg.tool_call_id!);
          responsesInput.push({
            id: `${fcId}-output`,
            call_id: fcId,
            output: msg.content.toString(),
            type: 'function_call_output'
          });
        }
      }

      console.log(`🔍 Calling Responses API...`);

      const response_api = await this.openai.responses.create({
        model: agentConfig.llm.model,
        input: responsesInput,
        instructions: systemInstructions,
        tools: tools,
        tool_choice: 'required', // Force model to ALWAYS call a tool (eliminates plain text responses)
        temperature: agentConfig.llm.temperature,
        max_output_tokens: agentConfig.llm.maxTokens,
      });

      console.log(`🔍 Responses API response received`);
      console.log(`🔍 Response output length:`, response_api.output.length);

      // Convert Responses API output back to LangChain AIMessage format
      let responseContent = '';
      const toolCalls: any[] = [];

      for (const outputItem of response_api.output) {
        if ('type' in outputItem) {
          if (outputItem.type === 'message' && 'content' in outputItem) {
            // Extract text content from message
            const content = outputItem.content;
            if (Array.isArray(content)) {
              for (const contentPart of content) {
                if ('type' in contentPart && 'text' in contentPart) {
                  responseContent += (contentPart as any).text;
                }
              }
            }
          } else if (outputItem.type === 'function_call' && 'name' in outputItem && 'arguments' in outputItem) {
            // Extract function/tool calls with safe JSON parsing
            try {
              toolCalls.push({
                id: (outputItem as any).call_id || (outputItem as any).id,
                name: (outputItem as any).name,
                args: JSON.parse((outputItem as any).arguments)
              });
            } catch (parseError) {
              // Handle malformed JSON from LLM gracefully
              console.error(`❌ Failed to parse tool arguments for ${(outputItem as any).name}:`, parseError);
              console.error(`   Raw arguments string: ${(outputItem as any).arguments}`);
              console.warn(`   ⚠️  Skipping malformed tool call - agent will continue with remaining tools`);
              // Don't add this tool call, but continue processing other tools
            }
          }
        }
      }

      // Fallback to output_text if no content extracted
      if (!responseContent && response_api.output_text) {
        responseContent = response_api.output_text;
      }

      const response = new AIMessage({
        content: responseContent,
        tool_calls: toolCalls
      });

      console.log(`🔍 Raw response:`, JSON.stringify(response, null, 2).substring(0, 1000));

      // ALWAYS log (ignore traceSteps for debugging)
      console.log(`🔍 LLM responded!`);
      console.log(`🔍 Response type: ${typeof response}`);
      console.log(`🔍 Response keys: ${Object.keys(response)}`);
      console.log(`🔍 response.tool_calls:`, response.tool_calls);

      if (response.content) {
        const content = response.content.toString();
        console.log(
          `💭 Agent response content (${content.length} chars): ${content.substring(0, 200)}...`
        );
      } else {
        console.log(`💭 Agent response has NO content`);
      }

      // Log tool calls if any
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`🔧 LLM wants to call ${response.tool_calls.length} tool(s):`);
        response.tool_calls.forEach(tc => {
          console.log(`   → ${tc.name}(${JSON.stringify(tc.args).substring(0, 100)})`);
        });
      } else {
        console.log(`❌ LLM made NO tool calls - will finish immediately`);
        console.log(`❌ This means the LLM responded with text instead of calling tools!`);
      }

      return {
        messages: [response],
      };
    } catch (error: any) {
      console.error('❌ LLM Node error:', error);
      return {
        error: `LLM error: ${error.message}`,
        answer: 'I encountered an error while processing your question. Please try again.',
      };
    }
  }

  /**
   * Tools Node - Execute tools
   */
  private async toolsNode(state: typeof StateAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const toolCalls = lastMessage.tool_calls || [];

    if (loggingConfig.traceSteps) {
      console.log(`\n🔧 Tools Node - Executing ${toolCalls.length} tool(s)`);
    }

    const toolMessages: ToolMessage[] = [];
    let newConsecutiveSearchCalls = state.consecutiveSearchCalls || 0;

    for (const toolCall of toolCalls) {
      if (loggingConfig.traceSteps) {
        console.log(`  ↳ ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
      }

      // ANTI-LOOP ENFORCEMENT: Block 3rd consecutive search
      if (toolCall.name === 'search_dataset_metadata') {
        if (newConsecutiveSearchCalls >= 2) {
          // HARD LIMIT REACHED - Block the call
          const errorMessage = `🚫 SEARCH LIMIT ENFORCED: You have already called search_dataset_metadata ${newConsecutiveSearchCalls} times in a row. You MUST now use query_structured_data to query the datasets you already found. Do NOT search again - work with what you have!`;

          console.warn(errorMessage);

          toolMessages.push(
            new ToolMessage({
              content: JSON.stringify({
                blocked: true,
                error: errorMessage,
                message: 'Search limit reached. You must now query the data you already found using query_structured_data.',
                searchCallsUsed: newConsecutiveSearchCalls,
                limit: 2,
              }),
              tool_call_id: toolCall.id!,
              name: toolCall.name,
            })
          );

          // Don't increment further, keep at limit
          continue;
        }

        // Increment search counter
        newConsecutiveSearchCalls += 1;
        console.log(`📊 Search call count: ${newConsecutiveSearchCalls}/2`);
      } else {
        // Different tool called - reset search counter
        if (newConsecutiveSearchCalls > 0) {
          console.log(`🔄 Resetting search counter (was ${newConsecutiveSearchCalls})`);
        }
        newConsecutiveSearchCalls = 0;
      }

      try {
        // Execute tool via registry
        const { result, error } = await toolRegistry.execute(toolCall.name, toolCall.args);

        const content = error || JSON.stringify(result);

        toolMessages.push(
          new ToolMessage({
            content: content,
            tool_call_id: toolCall.id!,
            name: toolCall.name,
          })
        );

        if (loggingConfig.traceSteps) {
          const preview = content.substring(0, 150);
          console.log(`  ✅ Result: ${preview}${content.length > 150 ? '...' : ''}`);
        }
      } catch (error: any) {
        console.error(`❌ Tool ${toolCall.name} failed:`, error);

        toolMessages.push(
          new ToolMessage({
            content: `Error: ${error.message}`,
            tool_call_id: toolCall.id!,
            name: toolCall.name,
          })
        );
      }
    }

    return {
      messages: toolMessages,
      consecutiveSearchCalls: newConsecutiveSearchCalls,
    };
  }

  /**
   * Router Node - Decide to continue or end
   */
  private routerNode(state: typeof StateAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1];

    // Check if agent called 'finish' tool
    if (lastMessage && 'tool_call_id' in lastMessage) {
      const toolMessage = lastMessage as ToolMessage;

      if (toolMessage.name === 'finish') {
        try {
          const result = JSON.parse(toolMessage.content);

          if (loggingConfig.traceSteps) {
            console.log('\n🏁 Agent finished with answer');
          }

          return {
            answer: result.answer,
            loopCount: state.loopCount + 1,
          };
        } catch (e) {
          // If parsing fails, use content directly
          return {
            answer: toolMessage.content,
            loopCount: state.loopCount + 1,
          };
        }
      }
    }

    // Increment loop count
    return {
      loopCount: state.loopCount + 1,
    };
  }

  /**
   * Conditional edge: Should agent use tools?
   */
  private shouldUseTool(state: typeof StateAnnotation.State): 'useTool' | 'finish' {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

    // If there's an error, finish
    if (state.error) {
      return 'finish';
    }

    // If LLM wants to call tools
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return 'useTool';
    }

    // Otherwise finish (LLM responded without calling tools)
    // Note: With tool_choice='required', this shouldn't happen
    return 'finish';
  }

  /**
   * Conditional edge: Should agent continue reasoning?
   */
  private shouldContinue(state: typeof StateAnnotation.State): 'continue' | 'end' {
    // If we have an answer, end
    if (state.answer) {
      return 'end';
    }

    // If max loops reached, force end
    if (state.loopCount >= agentConfig.maxLoops) {
      console.warn(`⚠️  Max loops (${agentConfig.maxLoops}) reached, forcing completion`);
      return 'end';
    }

    // Otherwise continue reasoning
    return 'continue';
  }

  /**
   * Execute agent query
   */
  async query(question: string): Promise<AgenticQueryResult> {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🤖 Agentic RAG Query: "${question}"`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📋 Agent Configuration:`);
    console.log(`   Model: ${agentConfig.llm.model}`);
    console.log(`   Temperature: ${agentConfig.llm.temperature}`);
    console.log(`   Max Output Tokens: ${agentConfig.llm.maxTokens}`);
    console.log(`   Max Loops (Config): ${agentConfig.maxLoops}`);
    console.log(`   Recursion Limit (Graph): 50`);
    console.log(`   Timeout: ${agentConfig.timeout}ms`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Initialize state
      const initialState = {
        messages: [],
        question: question,
        answer: null,
        loopCount: 0,
        error: null,
        consecutiveSearchCalls: 0,
      };

      console.log('🔍 DEBUG: Initial state:', initialState);
      console.log('🔍 DEBUG: About to invoke graph...');

      // Run graph
      const result = await this.graph.invoke(initialState);

      console.log('🔍 DEBUG: Graph returned result');
      console.log('🔍 DEBUG: Result keys:', Object.keys(result));
      console.log('🔍 DEBUG: Result.loopCount:', result.loopCount);
      console.log('🔍 DEBUG: Result.messages.length:', result.messages?.length);
      console.log('🔍 DEBUG: Result.answer:', result.answer?.substring(0, 100));

      const duration = Date.now() - startTime;

      // Extract answer
      let answer = result.answer;

      // If no answer, extract from last message
      if (!answer) {
        const lastMessage = result.messages[result.messages.length - 1];
        if (lastMessage && 'content' in lastMessage) {
          answer = lastMessage.content.toString();
        } else {
          answer = 'Unable to generate an answer. Please try rephrasing your question.';
        }
      }

      // Extract reasoning trace and sources
      const thoughts: string[] = [];
      const toolsUsed: string[] = [];
      const sources: Source[] = [];

      for (const msg of result.messages) {
        if (msg instanceof AIMessage && msg.content) {
          thoughts.push(msg.content.toString());
        }
        if (msg instanceof AIMessage && msg.tool_calls) {
          toolsUsed.push(...msg.tool_calls.map(tc => tc.name));
        }

        // Extract sources from vector_search tool results
        if (msg instanceof ToolMessage && msg.name === 'vector_search') {
          try {
            const toolResult = JSON.parse(msg.content);
            if (toolResult.found && toolResult.results) {
              for (const result of toolResult.results) {
                // Handle both standard search (content) and hierarchical search (childChunk/parentChunk)
                const chunk = result.childChunk || result.parentChunk || result.content || '';

                sources.push({
                  chunk: chunk,
                  filename: result.metadata?.filename || 'unknown',
                  similarity: parseFloat(result.similarity) || 0,
                });
              }
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }

        // ENHANCED: Extract sources from query_structured_data tool results
        if (msg instanceof ToolMessage && msg.name === 'query_structured_data') {
          try {
            const toolResult = JSON.parse(msg.content);
            if (toolResult.found && toolResult.source) {
              // Create a pseudo-source from SQL query results
              const resultSummary = `SQL Query on ${toolResult.source.table} (${toolResult.source.filename}): ${toolResult.count} row(s) returned`;

              sources.push({
                chunk: resultSummary,
                filename: toolResult.source.filename || toolResult.source.table || 'database',
                similarity: 1.0, // Perfect match since it's from SQL
              });
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }

        // ENHANCED: Extract sources from search_dataset_metadata tool results
        if (msg instanceof ToolMessage && msg.name === 'search_dataset_metadata') {
          try {
            const toolResult = JSON.parse(msg.content);
            if (toolResult.found && toolResult.datasets) {
              for (const dataset of toolResult.datasets.slice(0, 3)) { // Top 3 datasets
                sources.push({
                  chunk: `Dataset: ${dataset.tableName} (${dataset.rowCount} rows) - ${dataset.description || 'No description'}`,
                  filename: dataset.filename || dataset.tableName,
                  similarity: parseFloat(dataset.relevance) || 0.8,
                });
              }
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ Agentic RAG Complete (${duration}ms)`);
      console.log(`   Loops: ${result.loopCount}/${agentConfig.maxLoops} (config) / 50 (recursion limit)`);
      console.log(`   Tools: ${[...new Set(toolsUsed)].join(', ') || 'none'}`);
      console.log(`   Sources: ${sources.length} documents`);
      console.log(`${'='.repeat(60)}\n`);

      return {
        answer: answer,
        sources: sources,
        reasoning: {
          thoughts: thoughts,
          toolsUsed: [...new Set(toolsUsed)],
          loopCount: result.loopCount,
        },
        metadata: {
          duration: duration,
          model: agentConfig.llm.model,
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      console.error(`\n❌ Agentic RAG Error (${duration}ms):`, error);

      throw new Error(`Agent execution failed: ${error.message}`);
    }
  }
}
