/**
 * VectorSearchTool - Wraps VectorSearch service as an agent tool
 * Allows agent to search the document vector database
 */

import type { AgentTool } from '../types/agent.types';
import { VectorSearch } from '../services/vectorSearch';
import { agentConfig } from '../config/agent.config';

/**
 * Create vector search tool
 */
export function createVectorSearchTool(vectorSearch: VectorSearch): AgentTool {
  return {
    name: 'vector_search',

    description: `Search the document vector database for relevant information about PE deals, companies, financial data, and documents.
Use this tool when you need to find information from existing uploaded documents.
Returns the most relevant document chunks with similarity scores.`,

    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query to find relevant documents. Be specific and use keywords related to PE deals, companies, or financial metrics.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
          default: agentConfig.tools.vectorSearch.maxResults,
        },
      },
      required: ['query'],
    },

    async function(args: Record<string, any>) {
      const { query, maxResults = agentConfig.tools.vectorSearch.maxResults } = args;

      console.log(`🔍 Vector search: "${query}" (max: ${maxResults})`);

      try {
        const results = await vectorSearch.search(query, maxResults);

        if (!results || results.length === 0) {
          return {
            found: false,
            message: `No relevant documents found for query: "${query}"`,
            results: [],
          };
        }

        // Format results for agent
        const formattedResults = results.map((result, index) => ({
          rank: index + 1,
          content: result.content.substring(0, 500), // Limit content length
          similarity: result.similarity !== undefined ? result.similarity.toFixed(3) : 'N/A',
          metadata: {
            filename: result.metadata?.filename || 'unknown',
            type: result.metadata?.type || 'unknown',
            chunkIndex: result.metadata?.chunkIndex || 0,
          },
        }));

        const topSimilarity =
          results[0].similarity !== undefined ? results[0].similarity.toFixed(3) : 'N/A';
        console.log(
          `✅ Found ${results.length} relevant documents (best similarity: ${topSimilarity})`
        );

        return {
          found: true,
          count: results.length,
          results: formattedResults,
          summary: `Found ${results.length} relevant documents. Top result from ${results[0].metadata?.filename || 'unknown'} with similarity ${topSimilarity}.`,
        };
      } catch (error: any) {
        console.error('❌ Vector search failed:', error);
        throw new Error(`Vector search failed: ${error.message}`);
      }
    },
  };
}
