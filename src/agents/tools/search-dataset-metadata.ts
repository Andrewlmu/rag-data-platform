import type { AgentTool } from '../../types/agent.types';
import { VectorSearch } from '../../services/vectorSearch';

export function createSearchDatasetMetadataTool(vectorSearch: VectorSearch): AgentTool {
  return {
    name: 'search_dataset_metadata',

    description: `Find structured datasets (CSV/Excel) by semantic search.

**When to use:**
This is your FIRST STEP for any structured data query. Call this before query_structured_data.

**What you get back:**
- tableName: Use this identifier in query_structured_data
- schema: Array of {name, type} for each column - CRITICAL for accurate SQL
- description: What data the table contains
- rowCount: Number of rows in the dataset
- relevance: How well this dataset matches your query

**Schema usage (CRITICAL):**
The schema shows EXACT column names. Use them exactly as provided:
- If schema shows "First Tooltip" → Use "First Tooltip" in SQL (with quotes)
- If schema shows separate Quarter and Year columns → Use separate filters
- Column names are case-sensitive

**Example response:**
{
  tableName: "infant_mortality",
  schema: [
    {name: "Period", type: "INTEGER"},
    {name: "Location", type: "TEXT"},
    {name: "First Tooltip", type: "TEXT"}
  ],
  rowCount: 37440
}

Then in query_structured_data: SELECT Location, "First Tooltip" FROM infant_mortality WHERE Period = 2019

**Anti-loop rule:**
- Maximum 2 consecutive calls to this tool
- After finding datasets, you MUST proceed to query_structured_data
- Don't search for perfect auxiliary tables - work with what you found`,

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
