import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { ParsedData, analyzeColumn } from './parsers/csv-parser.js';

export interface DatasetMetadata {
  tableName: string;
  filename: string;
  description: string;
  rowCount: number;
  columnCount: number;
}

export class MetadataGenerator {
  private llm: ChatOpenAI;

  constructor(llm: ChatOpenAI) {
    this.llm = llm;
  }

  async generate(data: ParsedData, tableName: string): Promise<string> {
    console.log(`🧠 Generating metadata for ${data.filename}...`);

    // Build schema description
    const schemaDescription = data.headers
      .map((header, i) => {
        const columnAnalysis = analyzeColumn(data.rows, header);
        return `- ${header} (${data.types[i]}): ${columnAnalysis}`;
      })
      .join('\n');

    // Format sample rows
    const sampleRowsFormatted = data.sampleRows
      .slice(0, 5)
      .map(row => {
        return data.headers.map(h => `${h}: ${row[h]}`).join(', ');
      })
      .join('\n');

    // Build prompt
    const prompt = `You are analyzing a structured dataset for a Private Equity analysis system.

Dataset: ${data.filename}
Total Records: ${data.rowCount}
Columns: ${data.columnCount}

Schema:
${schemaDescription}

Sample Data (first 5 rows):
${sampleRowsFormatted}

Generate a comprehensive metadata description that includes:
1. **High-level description**: What this dataset contains (1-2 sentences)
2. **Structure**: Brief overview of dimensions (time periods, entities, metrics)
3. **Key Patterns**: Any trends, anomalies, or notable patterns in the data
4. **Coverage Analysis**: Completeness, gaps, or missing data
5. **Queryable For**: What types of questions can be answered with this data

Format your response as a clear, structured document that will help an AI agent understand this dataset.
Focus on business-relevant insights for PE analysis.
Keep it concise but informative.

Table Name: ${tableName}`;

    try {
      const messages = [
        new SystemMessage('You are a data analyst specializing in private equity portfolio data.'),
        new HumanMessage(prompt),
      ];

      const response = await this.llm.invoke(messages);

      const metadata =
        typeof response.content === 'string' ? response.content : String(response.content);

      console.log(`✅ Generated metadata (${metadata.length} characters)`);

      return metadata;
    } catch (error: any) {
      console.error(`❌ Metadata generation failed: ${error.message}`);
      // Fallback to basic metadata
      return this.generateBasicMetadata(data, tableName);
    }
  }

  private generateBasicMetadata(data: ParsedData, tableName: string): string {
    return `Dataset: ${data.filename}

Structure:
- ${data.rowCount} records
- ${data.columnCount} columns
- Columns: ${data.headers.join(', ')}

Table Name: ${tableName}

This is a structured dataset that can be queried using SQL.`;
  }
}
