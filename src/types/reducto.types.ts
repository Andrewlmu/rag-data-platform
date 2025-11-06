/**
 * Reducto API TypeScript Definitions
 * Based on official Reducto API documentation
 * @see https://docs.reducto.ai/
 */

/**
 * Configuration for ReductoClient
 */
export interface ReductoConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * Options for parsing documents
 */
export interface ReductoParseOptions {
  /** Chunking strategy for retrieval
   * - page_sections: Best for RAG (recommended)
   * - section: By document sections
   * - page: One chunk per page
   * - block: Fine-grained blocks
   * - disabled: No chunking
   */
  chunking_mode?: 'page_sections' | 'section' | 'page' | 'block' | 'disabled';

  /** Table output format
   * - dynamic: Auto-detect best format
   * - json: Programmatic access
   * - markdown: LLM-friendly
   * - html: Web display
   * - csv: Data analysis
   */
  table_output_format?: 'dynamic' | 'json' | 'markdown' | 'html' | 'csv';

  /** OCR system to use
   * - standard: Clean PDFs (faster)
   * - advanced: Scanned docs, handwriting
   */
  ocr_system?: 'standard' | 'advanced';

  /** Generate embeddings with content */
  enable_embeddings?: boolean;

  /** Page range to process (e.g., "1-5", "1,3,5") */
  page_range?: string;

  /** Processing timeout in seconds */
  timeout?: number;

  /** Document password if encrypted */
  password?: string;
}

/**
 * A content block within a document
 */
export interface ReductoBlock {
  /** Block type */
  type: 'Header' | 'Text' | 'Table' | 'Figure' | 'Caption' | 'List';

  /** Extracted content */
  content: string;

  /** AI confidence in extraction */
  confidence: 'high' | 'medium' | 'low';

  /** Bounding box coordinates */
  bbox?: {
    left: number;
    top: number;
    width: number;
    height: number;
    page: number;
  };

  /** OCR confidence score (0-1) */
  ocr_confidence?: number;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * A semantic chunk of content
 */
export interface ReductoChunk {
  /** Main text content */
  content: string;

  /** Vector embedding (if requested) */
  embedding?: number[];

  /** Constituent blocks */
  blocks: ReductoBlock[];

  /** Chunk metadata */
  metadata?: {
    page_numbers?: number[];
    section_title?: string;
    [key: string]: any;
  };
}

/**
 * Successful parse result
 */
export interface ReductoParseResult {
  /** Unique job identifier */
  job_id: string;

  /** Processing duration in seconds */
  duration: number;

  /** Usage statistics */
  usage: {
    num_pages: number;
    credits?: number;
    tokens?: number;
  };

  /** Parsed content */
  result: {
    /** Result delivery type */
    type: 'full' | 'url';

    /** Extracted chunks */
    chunks: ReductoChunk[];

    /** Link to view in Reducto Studio */
    studio_link?: string;
  };
}

/**
 * Error detail from API
 */
export interface ReductoErrorDetail {
  /** Error location in request */
  loc: string[];

  /** Human-readable message */
  msg: string;

  /** Error type */
  type: string;
}

/**
 * Error response from Reducto API
 */
export interface ReductoError {
  detail: ReductoErrorDetail[];
}

/**
 * Statistics tracked by ReductoClient
 */
export interface ReductoStats {
  /** Total documents processed */
  documentsProcessed: number;

  /** Total credits consumed */
  creditsUsed: number;

  /** Average credits per document */
  averageCreditsPerDoc: number;

  /** Total pages processed */
  totalPages: number;

  /** Average processing time (ms) */
  averageProcessingTime: number;
}
