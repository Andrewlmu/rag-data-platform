import type { AgentTool } from '../../types/agent.types';
import { DuckDBManager } from '../../structured-data/duckdb-manager';

export function createQueryStructuredDataTool(duckdb: DuckDBManager): AgentTool {
  return {
    name: 'query_structured_data',

    description: `Execute SQL queries on structured datasets (CSV/Excel).

**When to use:**
After search_dataset_metadata provides table schema, use this to get exact values from the data.

**SQL Pattern Quick Reference:**

1. SIMPLE LOOKUP: "What was X's Y?"
   SELECT [Metric] FROM table WHERE [Entity] = 'X'
   Example: SELECT Revenue FROM sales WHERE Company = 'Acme'

2. AGGREGATION: "average", "total", "sum"
   SELECT AVG([Metric]) FROM table WHERE [Filter]
   Example: SELECT AVG(Rate) FROM mortality WHERE Period = 2019

3. COMPARISON: "which had highest"
   SELECT [Entity], [Metric] FROM table ORDER BY [Metric] DESC LIMIT 10
   Example: SELECT Country, Rate FROM mortality ORDER BY Rate DESC LIMIT 10

4. TREND: "show over time"
   SELECT [Period], [Metric] FROM table WHERE [Entity] = 'X' ORDER BY [Period]
   Example: SELECT Year, GDP FROM economics WHERE Country = 'USA' ORDER BY Year

**Critical SQL rules:**
- Use EXACT column names from schema (case-sensitive, including spaces)
- If schema shows "First Tooltip", write "First Tooltip" not FirstTooltip
- Separate columns need separate filters: Quarter = 'Q3' AND Year = 2024
- For comparisons, return multiple rows (10+), not just min/max
- Only SELECT allowed (no INSERT, UPDATE, DELETE, DROP)

**Example usage:**
Schema: [{name: "Period", type: "INTEGER"}, {name: "Location", type: "TEXT"}, {name: "Rate", type: "REAL"}]
SQL: SELECT Location, Rate FROM mortality WHERE Period = 2019 ORDER BY Rate DESC LIMIT 10

Returns: Exact data rows with source attribution.`,

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
