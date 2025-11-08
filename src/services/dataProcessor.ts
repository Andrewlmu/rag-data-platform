import { VectorSearchService } from './vectorSearch';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentParser, ParsedDocument } from './documentParser';
import { HierarchicalChunker } from './hierarchicalChunker';
import { DocumentStore } from './documentStore';
import type { HierarchicalChunk } from '../types/hierarchical.types';
import { DuckDBManager } from '../structured-data/duckdb-manager.js';
import { MetadataGenerator } from '../structured-data/metadata-generator.js';
import { parseCSV } from '../structured-data/parsers/csv-parser.js';
import { ChatOpenAI } from '@langchain/openai';

export interface DataStats {
  totalFiles: number;
  vectorEmbeddings: number;
  documentTypes: Record<string, number>;
  lastUpdated: string;
  structuredRecords: {
    companies: number;
    transactions: number;
    customers: number;
  };
}

export class DataProcessor {
  private vectorSearch: VectorSearchService | null = null;
  private documentParser: DocumentParser;
  private hierarchicalChunker: HierarchicalChunker | null = null;
  private documentStore: DocumentStore | null = null;
  private useHierarchicalChunking: boolean;
  private stats: DataStats;
  private duckdb: DuckDBManager;
  private metadataGenerator: MetadataGenerator | null = null;

  constructor(documentStore?: DocumentStore, vectorSearch?: VectorSearchService) {
    this.documentParser = new DocumentParser();
    this.documentStore = documentStore || null;
    this.vectorSearch = vectorSearch || null;
    this.useHierarchicalChunking = process.env.USE_HIERARCHICAL_CHUNKING === 'true';

    // Initialize structured data support
    this.duckdb = new DuckDBManager();

    // Initialize hierarchical chunker if enabled
    if (this.useHierarchicalChunking && this.documentStore) {
      this.hierarchicalChunker = new HierarchicalChunker();
      console.log('📊 Hierarchical chunking enabled');
    }

    this.stats = {
      totalFiles: 0,
      vectorEmbeddings: 0,
      documentTypes: {},
      lastUpdated: new Date().toISOString(),
      structuredRecords: {
        companies: 0,
        transactions: 0,
        customers: 0,
      },
    };
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing data processor with async pipeline...');

    // Initialize vector search if not already set
    if (!this.vectorSearch) {
      console.log('   Creating new VectorSearch instance (not shared)');
      this.vectorSearch = new VectorSearchService();
      await this.vectorSearch.initialize();
    } else {
      console.log('   Using shared VectorSearch instance ✅');
    }

    // Initialize DuckDB for structured data
    await this.duckdb.initialize();

    // Initialize metadata generator with LLM
    const llm = new ChatOpenAI({
      modelName: process.env.LLM_MODEL || 'gpt-4',
      temperature: 1, // GPT-5 only supports temperature=1 (default)
    });
    this.metadataGenerator = new MetadataGenerator(llm);

    // Create data directories if they don't exist
    await this.ensureDirectories();

    console.log('✅ Data processor initialized');
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = ['data/raw', 'data/processed', 'data/sample'];

    await Promise.all(
      dirs.map(async dir => {
        try {
          await fs.mkdir(dir, { recursive: true });
        } catch (error) {
          // Directory might already exist
        }
      })
    );
  }

  async processDocument(doc: ParsedDocument): Promise<void> {
    if (!this.vectorSearch) {
      throw new Error('Data processor not initialized');
    }

    // DUAL-PATH ROUTING: Check if this is structured data (CSV)
    if (this.isStructuredFile(doc.metadata.filename)) {
      await this.processStructuredFile(doc.content, doc.metadata.filename);
      return;
    }

    // UNSTRUCTURED PATH: Text documents (TXT, PDF, etc.)
    // Check if hierarchical chunking is enabled
    if (this.useHierarchicalChunking && this.hierarchicalChunker && this.documentStore) {
      await this.processWithHierarchicalChunking(doc);
    } else {
      // Standard chunking (original behavior)
      await this.vectorSearch.addDocument(doc);

      // Note: totalFiles and vectorEmbeddings are computed dynamically in getDataStats()
      const docType = doc.metadata.type;
      this.stats.documentTypes[docType] = (this.stats.documentTypes[docType] || 0) + 1;
      this.stats.lastUpdated = new Date().toISOString();

      console.log(`✅ Processed document: ${doc.metadata.filename}`);
    }
  }

  /**
   * Process document with hierarchical chunking (parent-child)
   */
  private async processWithHierarchicalChunking(doc: ParsedDocument): Promise<void> {
    console.log(`📊 Processing with hierarchical chunking: ${doc.metadata.filename}`);

    // Create hierarchical chunks from document content
    const { parents, children, stats } = await this.hierarchicalChunker!.createHierarchicalChunks(
      doc.content,
      doc.id,
      doc.metadata.filename
    );

    // Step 1: Store parent chunks in document store
    this.documentStore!.addMany(parents);

    // Step 2: Convert children to format expected by vectorSearch
    const childChunks = children.map(child => ({
      text: child.content,
      metadata: {
        ...child.metadata,
        parentId: child.parentId, // Critical: link to parent!
        chunkType: 'child',
      },
    }));

    // Step 3: Add children to vector store (for search)
    await this.vectorSearch!.addDocument({
      id: doc.id,
      content: doc.content,
      metadata: doc.metadata,
      chunks: childChunks,
    });

    // Step 4: Update statistics
    // Note: totalFiles and vectorEmbeddings are computed dynamically in getDataStats()
    const docType = doc.metadata.type;
    this.stats.documentTypes[docType] = (this.stats.documentTypes[docType] || 0) + 1;
    this.stats.lastUpdated = new Date().toISOString();

    console.log(`✅ Processed with hierarchical chunking:`);
    console.log(`   - ${stats.totalParents} parent chunks`);
    console.log(`   - ${stats.totalChildren} child chunks`);
    console.log(`   - ${stats.sectionsDetected} sections detected`);
  }

  /**
   * Process structured data file (CSV) - NEW DUAL-PATH APPROACH
   */
  private async processStructuredFile(content: string, filename: string): Promise<void> {
    console.log(`📊 Processing structured data: ${filename}`);

    if (!this.metadataGenerator) {
      throw new Error('Metadata generator not initialized');
    }

    // Step 1: Parse CSV
    const parsedData = await parseCSV(content, filename);
    console.log(`   Schema: ${parsedData.columnCount} columns, ${parsedData.rowCount} rows`);

    // Step 2: Load into DuckDB
    const tableName = await this.duckdb.createTable(parsedData);

    // Step 3: Generate enhanced metadata with statistical profiling
    const enhancedMetadata = await this.metadataGenerator.generateEnhanced(parsedData, tableName);

    // Step 4: Index THREE documents for comprehensive understanding
    const timestamp = Date.now();
    const baseMetadata = {
      filename: filename,
      tableId: tableName,
      rowCount: parsedData.rowCount,
      columnCount: parsedData.columnCount,
      schema: parsedData.headers.map((col, i) => ({
        name: col,
        type: parsedData.types[i],
      })),
      parsedAt: new Date().toISOString(),
      // Include profile metadata for rich context
      dataQuality: {
        completeness: enhancedMetadata.profile.dataQuality.completeness,
        missingValues: enhancedMetadata.profile.dataQuality.totalMissingValues,
      },
      insights: enhancedMetadata.profile.insights,
      gaps: enhancedMetadata.profile.gaps,
    };

    // Document 1: Basic description (for dataset discovery)
    await this.vectorSearch!.addDocument({
      id: `dataset_${tableName}_desc_${timestamp}`,
      content: enhancedMetadata.basicDescription,
      metadata: {
        ...baseMetadata,
        type: 'csv_description',
        documentType: 'description',
      },
      chunks: [
        {
          text: enhancedMetadata.basicDescription,
          metadata: {
            type: 'csv_description',
            tableId: tableName,
            filename: filename,
            schema: parsedData.headers.map((col, i) => ({
              name: col,
              type: parsedData.types[i],
            })),
          },
        },
      ],
    });

    // Document 2: Statistical summary (for statistical queries)
    await this.vectorSearch!.addDocument({
      id: `dataset_${tableName}_stats_${timestamp}`,
      content: enhancedMetadata.statisticalSummary,
      metadata: {
        ...baseMetadata,
        type: 'csv_statistics',
        documentType: 'statistics',
      },
      chunks: [
        {
          text: enhancedMetadata.statisticalSummary,
          metadata: {
            type: 'csv_statistics',
            tableId: tableName,
            filename: filename,
          },
        },
      ],
    });

    // Document 3: Insights & gaps (for proactive analysis)
    await this.vectorSearch!.addDocument({
      id: `dataset_${tableName}_insights_${timestamp}`,
      content: enhancedMetadata.insightsDocument,
      metadata: {
        ...baseMetadata,
        type: 'csv_insights',
        documentType: 'insights',
      },
      chunks: [
        {
          text: enhancedMetadata.insightsDocument,
          metadata: {
            type: 'csv_insights',
            tableId: tableName,
            filename: filename,
            gaps: enhancedMetadata.profile.gaps,
            anomalies: enhancedMetadata.profile.anomalies,
          },
        },
      ],
    });

    // Update stats - CSV files create 3 metadata documents
    // Note: totalFiles and vectorEmbeddings are computed dynamically in getDataStats()
    this.stats.documentTypes['csv_description'] =
      (this.stats.documentTypes['csv_description'] || 0) + 1;
    this.stats.documentTypes['csv_statistics'] =
      (this.stats.documentTypes['csv_statistics'] || 0) + 1;
    this.stats.documentTypes['csv_insights'] = (this.stats.documentTypes['csv_insights'] || 0) + 1;
    this.stats.lastUpdated = new Date().toISOString();

    console.log(`✅ Processed structured data: ${tableName}`);
    console.log(`   - Table: ${tableName}`);
    console.log(`   - Rows: ${parsedData.rowCount}`);
    console.log(`   - Metadata indexed for semantic search`);
  }

  /**
   * Detect if file is structured data (CSV)
   */
  private isStructuredFile(filename: string): boolean {
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'csv';
  }

  /**
   * Utility: Create text chunks from document content
   */
  private async createChunks(
    content: string,
    filename: string
  ): Promise<
    Array<{
      text: string;
      metadata: Record<string, any>;
    }>
  > {
    const chunkSize = 1000;
    const overlap = 200;
    const chunks: Array<{ text: string; metadata: Record<string, any> }> = [];

    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      const chunk = content.slice(i, i + chunkSize);
      if (chunk.trim().length > 0) {
        chunks.push({
          text: chunk,
          metadata: {
            source: filename,
            chunkIndex: chunks.length,
            startPosition: i,
          },
        });
      }
    }

    return chunks;
  }

  private getFileType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const typeMap: Record<string, string> = {
      csv: 'csv',
      txt: 'text',
      pdf: 'pdf',
      xlsx: 'excel',
      docx: 'word',
    };
    return typeMap[ext || ''] || 'unknown';
  }

  async getDataStats(): Promise<DataStats> {
    if (this.vectorSearch) {
      const vectorStats = await this.vectorSearch.getStats();
      this.stats.vectorEmbeddings = vectorStats.vectorEmbeddings;
      this.stats.totalFiles = vectorStats.totalFiles;
    }

    return this.stats;
  }

  /**
   * Get DuckDB manager for structured data queries
   */
  getDuckDB(): DuckDBManager {
    return this.duckdb;
  }

  /**
   * Get VectorSearch instance for manual cache saves
   */
  getVectorSearch(): VectorSearchService | null {
    return this.vectorSearch;
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up data processor...');
    if (this.vectorSearch) {
      await this.vectorSearch.cleanup();
    }
    await this.duckdb.close();
  }
}
