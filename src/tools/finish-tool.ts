/**
 * FinishTool - Signals agent to complete and return answer
 * Required for ReAct pattern - agent calls this when ready to answer
 */

import type { AgentTool } from '../types/agent.types';

/**
 * Create finish tool
 */
export function createFinishTool(): AgentTool {
  return {
    name: 'finish',

    description: `Return your final answer to the user. REQUIRED when you have the complete answer.

**When to call:**
- After gathering all necessary data from other tools
- When you have formulated a complete response
- This is MANDATORY - you cannot end without calling finish

**What to include in your answer:**
- Direct answer to the user's question with specific facts (numbers, names, dates)
- For comparisons: show multiple entities with their values
- Source citations (table name or filename)
- Brief explanation if data doesn't perfectly match request

**Example answer format:**
"The top 3 countries with highest infant mortality rates in 2019 were:
1. Nigeria: 75.2 deaths per 1000 births
2. Chad: 72.1 deaths per 1000 births
3. Somalia: 70.8 deaths per 1000 births

(Source: infant_mortality table)"

Do NOT call this if you still need more data - use other tools first.`,

    parameters: {
      type: 'object',
      properties: {
        answer: {
          type: 'string',
          description: `Your comprehensive final answer to the user's question. Include:
- Direct response to the question
- Supporting evidence from sources
- Source citations (filename, page/sheet if applicable)
- Any relevant caveats or limitations`,
        },
      },
      required: ['answer'],
    },

    async function(args: Record<string, any>) {
      const { answer } = args;

      console.log(`🏁 Agent calling finish with answer (${answer.length} chars)`);

      // Simply return the answer
      // The graph router will detect this tool call and end the loop
      return {
        finished: true,
        answer: answer,
      };
    },
  };
}
