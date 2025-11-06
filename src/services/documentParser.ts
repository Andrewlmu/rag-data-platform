import pdf from 'pdf-parse';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ReductoClient } from './reducto-client';

export interface ParsedDocument {
  id: string;
  content: string;
  metadata: {
    filename: string;
    type: string;
    size: number;
    parsedAt: string;
    [key: string]: any;
  };
  chunks: Array<{
    text: string;
    metadata: Record<string, any>;
  }>;
}

export class DocumentParser {
  private textSplitter: RecursiveCharacterTextSplitter;
  private reductoClient: ReductoClient | null = null;

  constructor() {
    // Configure text splitter for optimal chunk sizes
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });

    // Initialize Reducto if enabled
    if (process.env.USE_REDUCTO === 'true') {
      if (!process.env.REDUCTO_API_KEY) {
        console.warn('⚠️  USE_REDUCTO=true but REDUCTO_API_KEY not set');
      } else {
        try {
          this.reductoClient = new ReductoClient({
            apiKey: process.env.REDUCTO_API_KEY,
            retryAttempts: 3,
            timeout: 30000,
          });
          console.log('✅ Reducto client initialized for enhanced PDF parsing');
        } catch (error) {
          console.error('❌ Failed to initialize Reducto client:', error);
          console.log('📄 Falling back to pdf-parse');
        }
      }
    } else {
      console.log('📄 Using standard pdf-parse (USE_REDUCTO=false)');
    }
  }

  async parseDocument(file: Express.Multer.File): Promise<ParsedDocument> {
    const startTime = Date.now();
    const fileType = this.getFileType(file.originalname);

    try {
      let content: string;
      let metadata: Record<string, any> = {
        filename: file.originalname,
        type: fileType,
        size: file.size,
        parsedAt: new Date().toISOString(),
      };

      // Parse based on file type
      switch (fileType) {
        case 'pdf':
          content = await this.parsePDF(file.buffer);
          break;

        case 'excel':
          const excelData = await this.parseExcel(file.buffer);
          content = excelData.content;
          metadata = { ...metadata, ...excelData.metadata };
          break;

        case 'word':
          content = await this.parseWord(file.buffer);
          break;

        case 'csv':
          content = await this.parseCSV(file.buffer);
          break;

        case 'text':
          content = file.buffer.toString('utf-8');
          break;

        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Split content into chunks
      const chunks = await this.createChunks(content, metadata);

      // Generate document ID
      const id = this.generateDocumentId(file.originalname);

      const processingTime = Date.now() - startTime;
      console.log(`📄 Parsed ${file.originalname} in ${processingTime}ms`);

      return {
        id,
        content,
        metadata: {
          ...metadata,
          processingTime,
          chunksCount: chunks.length,
        },
        chunks,
      };
    } catch (error) {
      console.error(`Error parsing ${file.originalname}:`, error);
      throw error;
    }
  }

  private async parsePDF(buffer: Buffer): Promise<string> {
    // Try Reducto first if available
    if (this.reductoClient) {
      try {
        console.log('🔵 Using Reducto for PDF parsing...');
        const text = await this.reductoClient.parsePDF(buffer);

        if (!text || text.trim().length === 0) {
          throw new Error('Reducto returned empty content');
        }

        console.log(`✅ Reducto parsed ${text.length} characters`);
        return text;
      } catch (error) {
        console.error('❌ Reducto parsing failed:', error);
        console.log('📄 Falling back to pdf-parse...');
        // Fall through to pdf-parse fallback
      }
    }

    // Fallback to standard pdf-parse
    try {
      console.log('📄 Using pdf-parse for PDF parsing...');
      const data = await pdf(buffer);
      console.log(`✅ pdf-parse extracted ${data.text.length} characters`);
      return data.text;
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF with both Reducto and pdf-parse');
    }
  }

  private async parseExcel(buffer: Buffer): Promise<{
    content: string;
    metadata: Record<string, any>;
  }> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const metadata: Record<string, any> = {
        sheetNames: workbook.SheetNames,
        sheetsCount: workbook.SheetNames.length,
      };

      let content = '';
      const dataFrames: Record<string, any[]> = {};

      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const csvData = XLSX.utils.sheet_to_csv(sheet);

        // Store structured data
        dataFrames[sheetName] = jsonData;

        // Add to content for text processing
        content += `\n\n=== Sheet: ${sheetName} ===\n${csvData}`;

        // Extract metadata from first sheet
        if (sheetName === workbook.SheetNames[0] && jsonData.length > 0) {
          metadata.rowCount = jsonData.length;
          metadata.columnCount = (jsonData[0] as any[]).length;
        }
      }

      metadata.dataFrames = dataFrames;

      return { content, metadata };
    } catch (error) {
      console.error('Excel parsing error:', error);
      throw new Error('Failed to parse Excel file');
    }
  }

  private async parseWord(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('Word parsing error:', error);
      throw new Error('Failed to parse Word document');
    }
  }

  private async parseCSV(buffer: Buffer): Promise<string> {
    try {
      const text = buffer.toString('utf-8');
      const workbook = XLSX.read(text, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_csv(sheet);
    } catch (error) {
      // Fallback to raw text if XLSX parsing fails
      return buffer.toString('utf-8');
    }
  }

  private async createChunks(
    content: string,
    metadata: Record<string, any>
  ): Promise<Array<{ text: string; metadata: Record<string, any> }>> {
    try {
      const documents = await this.textSplitter.createDocuments([content], [metadata]);

      return documents.map((doc, index) => ({
        text: doc.pageContent,
        metadata: {
          ...doc.metadata,
          chunkIndex: index,
          chunkTotal: documents.length,
        },
      }));
    } catch (error) {
      console.error('Chunking error:', error);
      // Return single chunk if splitting fails
      return [
        {
          text: content,
          metadata: { ...metadata, chunkIndex: 0, chunkTotal: 1 },
        },
      ];
    }
  }

  private getFileType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const typeMap: Record<string, string> = {
      pdf: 'pdf',
      xlsx: 'excel',
      xls: 'excel',
      docx: 'word',
      doc: 'word',
      csv: 'csv',
      txt: 'text',
    };

    return typeMap[ext || ''] || 'unknown';
  }

  private generateDocumentId(filename: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const cleanName = filename.replace(/[^a-zA-Z0-9]/g, '_');
    return `${cleanName}_${timestamp}_${random}`;
  }

  async parseMultipleDocuments(files: Express.Multer.File[]): Promise<ParsedDocument[]> {
    // Parse all documents in parallel for maximum async efficiency
    const parsePromises = files.map(file => this.parseDocument(file));
    return Promise.all(parsePromises);
  }

  /**
   * Get Reducto usage statistics (if enabled)
   * Useful for monitoring API costs and performance
   */
  getReductoStats() {
    if (this.reductoClient) {
      return this.reductoClient.getStats();
    }
    return null;
  }
}
