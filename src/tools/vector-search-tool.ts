/**
 * VectorSearchTool - Wraps VectorSearch service as an agent tool
 * Supports hierarchical retrieval (parent-child) when available
 */

import type { AgentTool } from '../types/agent.types';
import { VectorSearch } from '../services/vectorSearch';
import { ParentChildRetriever } from '../services/parentChildRetriever';
import { agentConfig } from '../config/agent.config';

/**
 * Create vector search tool with optional hierarchical retrieval
 */
export function createVectorSearchTool(
  vectorSearch: VectorSearch,
  parentChildRetriever?: ParentChildRetriever
): AgentTool {
  return {
    name: 'vector_search',

    description: `Search the document vector database for relevant information about PE deals, companies, financial data, and documents.
Use this tool when you need to find information from existing uploaded documents.
Returns the most relevant document chunks with similarity scores${parentChildRetriever ? ' and full parent context' : ''}.`,

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
        // Use hierarchical retrieval if available
        if (parentChildRetriever) {
          console.log('   Using hierarchical retrieval (parent-child)');
          const enhancedResults = await parentChildRetriever.retrieve(query, maxResults);

          if (!enhancedResults || enhancedResults.length === 0) {
            return {
              found: false,
              message: `No relevant documents found for query: "${query}"`,
              results: [],
            };
          }

          // Format hierarchical results for agent
          const formattedResults = enhancedResults.map((result, index) => ({
            rank: index + 1,
            childChunk: result.childChunk.substring(0, 300),
            parentChunk: result.parentChunk ? result.parentChunk.substring(0, 700) : undefined,
            similarity: result.childSimilarity.toFixed(3),
            metadata: {
              filename: result.childMetadata.filename || 'unknown',
              section: result.section || 'unknown',
              hierarchyPath: result.hierarchyPath?.join(' > ') || 'unknown',
            },
          }));

          const topSimilarity = enhancedResults[0].childSimilarity.toFixed(3);
          console.log(
            `✅ Found ${enhancedResults.length} hierarchical results (best similarity: ${topSimilarity})`
          );

          return {
            found: true,
            count: enhancedResults.length,
            results: formattedResults,
            hierarchical: true,
            summary: `Found ${enhancedResults.length} relevant sections with full context. Top result from ${enhancedResults[0].childMetadata.filename || 'unknown'} (${enhancedResults[0].section || 'unknown section'}) with similarity ${topSimilarity}.`,
          };
        }

        // Fallback to standard search
        console.log('   Using standard search');
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
          similarity: result.score !== undefined ? result.score.toFixed(3) : 'N/A',
          metadata: {
            filename: result.metadata?.filename || 'unknown',
            type: result.metadata?.type || 'unknown',
            chunkIndex: result.metadata?.chunkIndex || 0,
          },
        }));

        const topSimilarity = results[0].score !== undefined ? results[0].score.toFixed(3) : 'N/A';
        console.log(
          `✅ Found ${results.length} relevant documents (best similarity: ${topSimilarity})`
        );

        return {
          found: true,
          count: results.length,
          results: formattedResults,
          hierarchical: false,
          summary: `Found ${results.length} relevant documents. Top result from ${results[0].metadata?.filename || 'unknown'} with similarity ${topSimilarity}.`,
        };
      } catch (error: any) {
        console.error('❌ Vector search failed:', error);
        throw new Error(`Vector search failed: ${error.message}`);
      }
    },
  };
}
