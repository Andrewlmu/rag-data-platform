import type { AgentTool } from '../../types/agent.types';
import { DuckDBManager } from '../../structured-data/duckdb-manager';

export function createQueryStructuredDataTool(duckdb: DuckDBManager): AgentTool {
  return {
    name: 'query_structured_data',

    description: `Execute SQL queries on structured datasets (CSV/Excel files loaded into tables).

Use this when:
- User asks about numerical data, trends, comparisons, aggregations
- You need exact values from datasets (revenue, EBITDA, margins, etc.)
- You need to filter, group, or calculate statistics
- Questions like "What was X's revenue in Q3?", "Compare margins across companies", etc.

IMPORTANT:
- Only SELECT queries are allowed (no INSERT, UPDATE, DELETE, DROP)
- Use the table name exactly as provided from dataset metadata
- Results are deterministic and accurate (no hallucination)

Input:
- sql: The SELECT query to execute
- tableName: Table identifier from metadata search (e.g., "gamma_portfolio_quarterly_results")

Output: Query results with exact source attribution (row numbers, columns)`,

    parameters: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'SQL SELECT query to execute',
        },
        tableName: {
          type: 'string',
          description: 'Table name to query (from metadata)',
        },
      },
      required: ['sql', 'tableName'],
    },

    async function(args: Record<string, any>) {
      const { sql, tableName } = args;

      try {
        console.log(`🔧 Tool: query_structured_data`);
        console.log(`   Table: ${tableName}`);
        console.log(`   SQL: ${sql.substring(0, 100)}...`);

        // Execute query
        const result = await duckdb.query(sql);

        if (!result.success) {
          return {
            found: false,
            error: result.error,
          };
        }

        // Get table info for source attribution
        const tableInfo = duckdb.getTableInfo(tableName);

        // Convert BigInt values to regular numbers for JSON serialization
        const sanitizedResults = result.results.map((row: any) => {
          const sanitizedRow: any = {};
          for (const [key, value] of Object.entries(row)) {
            if (typeof value === 'bigint') {
              sanitizedRow[key] = Number(value);
            } else {
              sanitizedRow[key] = value;
            }
          }
          return sanitizedRow;
        });

        return {
          found: true,
          count: result.rowCount,
          results: sanitizedResults,
          source: {
            table: tableName,
            filename: tableInfo?.filename || 'unknown',
            query: sql,
          },
        };
      } catch (error: any) {
        console.error(`❌ query_structured_data error: ${error.message}`);
        return {
          found: false,
          error: error.message,
        };
      }
    },
  };
}
