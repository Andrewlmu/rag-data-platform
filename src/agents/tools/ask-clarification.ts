import type { AgentTool } from '../../types/agent.types';
import OpenAI from 'openai';

/**
 * Ask Clarification Tool
 *
 * When the agent is uncertain about query parameters, it calls this tool.
 * Instead of asking the user, this tool uses GPT-5 to automatically make
 * reasonable decisions and returns specific instructions.
 */

interface ClarificationResolution {
  decision: string;
  parameters: Record<string, any>;
  reasoning: string;
  sqlHint?: string;
}

const resolutionSchema = {
  type: 'object' as const,
  properties: {
    decision: {
      type: 'string' as const,
      description: 'Brief summary of the decision made (e.g., "Use year 2019, show top 10 countries")'
    },
    parameters: {
      type: 'object' as const,
      description: 'Specific parameters to use (e.g., {year: 2019, limit: 10, orderBy: "DESC"})',
      additionalProperties: true
    },
    reasoning: {
      type: 'string' as const,
      description: 'Brief explanation of why these decisions were made'
    },
    sqlHint: {
      type: 'string' as const,
      description: 'Optional SQL query hint based on the context (if applicable)'
    }
  },
  required: ['decision', 'parameters', 'reasoning'] as const,
  additionalProperties: false
};

export function createAskClarificationTool(openai: OpenAI): AgentTool {
  const model = process.env.CLARIFICATION_MODEL || 'gpt-5';

  return {
    name: 'ask_clarification',

    description: `Auto-resolve query ambiguities without asking the user.

**When to use:**
You're uncertain about specific parameters after finding datasets:
- Which year/time period to query
- Which entities to show (top 10? all? specific ones?)
- Which metric when multiple are available
- Sort order or filtering criteria

**How it works:**
This tool uses GPT-5 to make intelligent decisions based on context.
It does NOT ask the user - it returns specific parameters for you to use immediately.

**Example usage:**
{
  "uncertainties": "Which year? Which countries to show?",
  "context": "User asked 'show infant mortality rates'. Found infantmortalityrate table with Period (2000-2019), Location (195 countries). Schema: [{name: 'Period', type: 'INTEGER'}, {name: 'Location', type: 'TEXT'}, {name: 'Rate', type: 'REAL'}]"
}

**Returns:**
{
  decision: "Use year 2019, show top 10 countries",
  parameters: {year: 2019, limit: 10, orderBy: "DESC"},
  reasoning: "2019 is most recent. Top 10 provides meaningful comparison.",
  sqlHint: "WHERE Period = 2019 ORDER BY Rate DESC LIMIT 10"
}

Then use these parameters in your query_structured_data call.`,

    parameters: {
      type: 'object',
      properties: {
        uncertainties: {
          type: 'string',
          description: 'Describe what you\'re uncertain about. Be specific about what decisions need to be made.'
        },
        context: {
          type: 'string',
          description: 'Full context: original user question, datasets found, table schemas, available data ranges, column names, etc. Include as much detail as possible - the more context, the better the decisions.'
        }
      },
      required: ['uncertainties', 'context']
    },

    async function(args: Record<string, any>) {
      const { uncertainties, context } = args;

      console.log(`🔧 Tool: ask_clarification`);
      console.log(`   Uncertainties: ${uncertainties.substring(0, 100)}${uncertainties.length > 100 ? '...' : ''}`);
      console.log(`   Context length: ${context.length} chars`);

      try {
        // Use GPT-5 to intelligently resolve uncertainties
        const response = await openai.responses.create({
          model: model,

          // Optimize for speed (new API format)
          reasoning: {
            effort: 'minimal'  // Fastest mode for simple decisions
          },

          // Token limits (clarifications should be brief)
          max_output_tokens: 300,

          // Structured JSON output for reliability
          text: {
            format: {
              type: 'json_schema',
              name: 'clarification_resolution',
              schema: resolutionSchema,
              strict: true
            }
          },

          // System instructions
          instructions: `You are a decision-making assistant that resolves ambiguities in data queries.

When an agent is uncertain about parameters for a query, you make reasonable assumptions following these principles:

**DECISION PRINCIPLES:**
1. **Latest data first**: If uncertain about time period, choose the most recent year available
2. **Top N approach**: If uncertain about which entities, show top 10-15 ordered by the primary metric
3. **Comprehensive over specific**: If uncertain about scope, prefer showing more context rather than less
4. **Default to DESC**: For rankings/comparisons, order by metric descending (highest first)
5. **Complete answers**: Choose parameters that lead to a complete, useful answer
6. **Use available data**: Don't invent parameters - base decisions on what's actually in the dataset

**OUTPUT REQUIREMENTS:**
- Be SPECIFIC: Provide exact values (e.g., "year: 2019", not "latest year")
- Be ACTIONABLE: Agent must be able to use parameters immediately in SQL
- Be BRIEF: Keep decision and reasoning to 1-2 sentences each
- Include SQL hint if you have schema information

**EXAMPLES:**

Example 1:
Uncertainties: "Which year? Which countries?"
Context: "User: 'highest infant mortality rates'. Dataset: infantmortalityrate, Period: 2000-2019, Location: 195 countries"
Response: {
  decision: "Use year 2019. Show top 10 countries by mortality rate.",
  parameters: {year: 2019, limit: 10, orderBy: "DESC"},
  reasoning: "2019 is most recent. Top 10 provides meaningful comparison.",
  sqlHint: "WHERE Period = 2019 ORDER BY rate DESC LIMIT 10"
}

Example 2:
Uncertainties: "Time period for trend? Which regions?"
Context: "User: 'show climate trends'. Dataset: climate_data, Year: 1950-2023, Region: 50 regions, metrics: Temperature, Rainfall"
Response: {
  decision: "Show temperature trends 2014-2023 (last decade) for top 10 regions by warming.",
  parameters: {metric: "Temperature", yearStart: 2014, yearEnd: 2023, limit: 10},
  reasoning: "Recent decade most relevant for trends. Temperature is primary climate metric. Top 10 regions by change shows most impacted.",
  sqlHint: "WHERE Year >= 2014 ORDER BY Temperature DESC LIMIT 10"
}`,

          // Input message
          input: [
            {
              role: 'user',
              content: `An agent needs your help making decisions.

**Agent's uncertainties:**
${uncertainties}

**Full context:**
${context}

Analyze the context and make reasonable assumptions. Return your decision as JSON.`,
              type: 'message'
            }
          ],

          // Required parameters
          temperature: 1, // Only supported value for GPT-5
        });

        // Parse JSON from response
        let resolution: ClarificationResolution;

        // Try output_text first (primary JSON location)
        if (response.output_text) {
          resolution = JSON.parse(response.output_text);
        } else {
          // Fallback: extract from output array
          const textContent = response.output
            .filter((item: any) => item.type === 'message')
            .map((item: any) => {
              if (Array.isArray(item.content)) {
                return item.content
                  .filter((c: any) => c.type === 'text')
                  .map((c: any) => c.text)
                  .join('');
              }
              return '';
            })
            .join('');

          resolution = JSON.parse(textContent);
        }

        console.log(`✅ Clarification resolved by ${model}:`);
        console.log(`   Decision: ${resolution.decision}`);
        console.log(`   Parameters:`, resolution.parameters);
        console.log(`   Reasoning: ${resolution.reasoning}`);

        // Return formatted response for the agent
        return {
          resolved: true,
          decision: resolution.decision,
          parameters: resolution.parameters,
          reasoning: resolution.reasoning,
          sqlHint: resolution.sqlHint || '',
          instruction: `✅ Clarification resolved automatically.

**Decision:** ${resolution.decision}

**Parameters to use:**
${Object.entries(resolution.parameters).map(([k, v]) => `  - ${k}: ${JSON.stringify(v)}`).join('\n')}

**Reasoning:** ${resolution.reasoning}

${resolution.sqlHint ? `**SQL Hint:**\n${resolution.sqlHint}\n` : ''}
**Next step:** Use these parameters in your query_structured_data call. Do NOT ask the user for clarification.`
        };

      } catch (error: any) {
        console.error(`❌ ask_clarification error: ${error.message}`);

        // Fallback to generic defaults on error
        return {
          resolved: true,
          decision: 'Using generic defaults due to resolution error',
          parameters: {
            limit: 10,
            orderBy: 'DESC',
            useLatestData: true
          },
          reasoning: `Resolution failed (${error.message}). Falling back to safe defaults.`,
          instruction: `⚠️ Auto-resolution encountered an error. Using generic defaults:
- Use latest available data
- Show top 10 results
- Order by primary metric descending

Proceed with these defaults in your query.`
        };
      }
    }
  };
}
