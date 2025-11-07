import type { AgentTool } from '../../types/agent.types';
import { VectorSearch } from '../../services/vectorSearch';

export function createSearchDatasetMetadataTool(vectorSearch: VectorSearch): AgentTool {
  return {
    name: 'search_dataset_metadata',

    description: `Search for relevant structured datasets (CSV/Excel files) based on semantic query.

Use this FIRST when user asks about structured data to find which datasets are available.

Use this when:
- User asks about financial metrics, company data, portfolio information
- You need to find which tables/datasets contain relevant information
- Before querying structured data, to determine which table to query

Returns: Metadata descriptions of matching datasets including:
- Table names (for use with query_structured_data)
- Dataset descriptions (what data it contains)
- **Schema (CRITICAL): Array of {name, type} for each column - USE THIS FOR ACCURATE SQL QUERIES**
- Row counts and coverage information

IMPORTANT: The schema field contains EXACT column names - use these in your WHERE clauses!
Example: If schema shows [{name: "Quarter", type: "TEXT"}, {name: "Year", type: "INTEGER"}]
Then write: WHERE Quarter = 'Q3' AND Year = 2024
NOT: WHERE Quarter = 'Q3 2024'

Example: "quarterly financials" → finds tables with quarterly financial data`,

    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Semantic search query to find relevant datasets',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of datasets to return (default: 3)',
          default: 3,
        },
      },
      required: ['query'],
    },

    async function(args: Record<string, any>) {
      const { query, maxResults = 3 } = args;

      try {
        console.log(`🔧 Tool: search_dataset_metadata`);
        console.log(`   Query: "${query}"`);

        // Search only metadata documents (type: dataset_metadata)
        const results = await vectorSearch.search(query, maxResults);

        // Filter to only metadata documents (description, statistics, or insights)
        const metadataResults = results.filter(
          r =>
            r.metadata?.type === 'csv_description' ||
            r.metadata?.type === 'csv_statistics' ||
            r.metadata?.type === 'csv_insights'
        );

        if (metadataResults.length === 0) {
          return {
            found: false,
            message: 'No structured datasets found matching your query',
          };
        }

        // Format results with schema information
        const datasets = metadataResults.map(r => ({
          tableName: r.metadata?.tableId || 'unknown',
          filename: r.metadata?.filename || 'unknown',
          description: r.content,
          schema: r.metadata?.schema || [],
          rowCount: r.metadata?.rowCount || 0,
          relevance: r.score !== undefined ? (1 - r.score).toFixed(3) : 'N/A',
        }));

        console.log(`✅ Found ${datasets.length} matching datasets`);

        return {
          found: true,
          count: datasets.length,
          datasets,
        };
      } catch (error: any) {
        console.error(`❌ search_dataset_metadata error: ${error.message}`);
        return {
          found: false,
          error: error.message,
        };
      }
    },
  };
}
