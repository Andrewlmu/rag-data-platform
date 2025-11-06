/**
 * ReAct Agent - Reasoning + Acting pattern with LangGraph
 * Autonomous agent that uses tools to answer questions
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
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
});

/**
 * ReAct Agent using LangGraph
 */
export class ReactAgent {
  private llm: ChatOpenAI;
  private graph: any;

  constructor() {
    console.log('🔍 AgentConfig.llm.model:', agentConfig.llm.model);
    console.log('🔍 process.env.LLM_MODEL:', process.env.LLM_MODEL);

    // Initialize LLM with function calling
    this.llm = new ChatOpenAI({
      model: agentConfig.llm.model,
      temperature: agentConfig.llm.temperature,
      maxTokens: agentConfig.llm.maxTokens,
    });

    // Build the graph
    this.graph = this.buildGraph();

    console.log(`🤖 ReAct Agent initialized with LangGraph (model: ${agentConfig.llm.model})`);
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

      // After LLM, check if it wants to use tools
      .addConditionalEdges('llm', this.shouldUseTool.bind(this), {
        useTool: 'tools',
        finish: END,
      })

      // After tools, go to router
      .addEdge('tools', 'router')

      // Router decides: continue or end
      .addConditionalEdges('router', this.shouldContinue.bind(this), {
        continue: 'llm',
        end: END,
      });

    // Compile with increased recursion limit
    return workflow.compile({
      recursionLimit: 50, // Allow more loops for complex reasoning
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

      // Call LLM with tools
      console.log(`🔍 Calling LLM with ${messages.length} messages and ${tools.length} tools...`);
      console.log(`🔍 Messages being sent:`);
      messages.forEach((msg, i) => {
        const content = msg.content?.toString() || '[no content]';
        console.log(`  ${i + 1}. ${msg._getType()}: ${content.substring(0, 100)}...`);
      });
      console.log(`🔍 Tools being sent:`, JSON.stringify(tools, null, 2).substring(0, 500));

      // FIX: Bind tools to the model with explicit tool_choice (critical for function calling!)
      const llmWithTools = this.llm.bind({
        tools: tools,
        tool_choice: 'auto', // Explicitly enable tool calling
      });

      console.log(`🔍 Bound model with tools, invoking...`);

      const response = await llmWithTools.invoke(messages);

      console.log(`🔍 Raw response:`, JSON.stringify(response, null, 2).substring(0, 1000));

      // FIX: Parse tool calls from additional_kwargs if not in top-level
      // This is needed for older LangChain versions
      if (
        (!response.tool_calls || response.tool_calls.length === 0) &&
        response.additional_kwargs?.tool_calls?.length > 0
      ) {
        console.log(
          `🔧 Parsing tool calls from additional_kwargs (LangChain version compatibility fix)`
        );

        response.tool_calls = response.additional_kwargs.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments),
        }));

        console.log(`✅ Parsed ${response.tool_calls.length} tool call(s) from additional_kwargs`);
      }

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

    for (const toolCall of toolCalls) {
      if (loggingConfig.traceSteps) {
        console.log(`  ↳ ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
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
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Initialize state
      const initialState = {
        messages: [],
        question: question,
        answer: null,
        loopCount: 0,
        error: null,
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
                sources.push({
                  chunk: result.content,
                  filename: result.metadata?.filename || 'unknown',
                  similarity: parseFloat(result.similarity) || 0,
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
      console.log(`   Loops: ${result.loopCount}`);
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
