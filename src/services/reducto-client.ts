import { Reducto } from 'reductoai';
import type {
  ReductoConfig,
  ReductoParseOptions,
  ReductoParseResult,
  ReductoStats,
} from '../types/reducto.types';

/**
 * ReductoClient - Elegant wrapper for Reducto API
 *
 * Features:
 * - Type-safe API calls with full TypeScript support
 * - Automatic retry logic with exponential backoff
 * - Comprehensive error handling
 * - Usage tracking and statistics
 * - Performance monitoring
 *
 * @example
 * ```typescript
 * const client = new ReductoClient({
 *   apiKey: process.env.REDUCTO_API_KEY!
 * });
 *
 * const text = await client.parsePDF(pdfBuffer);
 * console.log(client.getStats());
 * ```
 */
export class ReductoClient {
  private client: Reducto;
  private config: ReductoConfig;

  // Usage tracking
  private stats = {
    documentsProcessed: 0,
    creditsUsed: 0,
    totalPages: 0,
    totalProcessingTime: 0,
  };

  constructor(config: ReductoConfig) {
    this.config = {
      baseUrl: 'https://platform.reducto.ai',
      timeout: 30000,
      retryAttempts: 3,
      ...config,
    };

    this.client = new Reducto({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
    });
  }

  /**
   * Parse a PDF document with Reducto
   *
   * @param file - PDF file as Buffer or file path
   * @param options - Parse options (optional)
   * @returns Extracted text content
   *
   * @throws Error if parsing fails after all retries
   */
  async parsePDF(file: Buffer | string, options: ReductoParseOptions = {}): Promise<string> {
    const startTime = Date.now();

    try {
      // Optimal defaults for PE document analysis
      const parseOptions: ReductoParseOptions = {
        chunking_mode: 'page_sections', // Best for RAG pipelines
        table_output_format: 'markdown', // LLM-friendly format
        ocr_system: 'standard', // Most PE docs are clean PDFs
        enable_embeddings: false, // We generate embeddings separately
        timeout: 60, // 60 seconds for parsing
        ...options, // Allow caller to override
      };

      console.log('🔵 Reducto: Starting PDF parse...');

      // Parse with automatic retry
      const result = await this.parseWithRetry(file, parseOptions);

      // Extract plain text from structured result
      const text = this.extractText(result);

      // Update statistics
      this.updateStats(result, Date.now() - startTime);

      console.log(
        `✅ Reducto: Parsed ${result.usage?.num_pages || 0} pages in ${
          result.duration?.toFixed(1) || 0
        }s (${text.length} chars)`
      );

      return text;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Reducto: Failed after ${duration}ms`, error);
      throw new Error(`Reducto parsing failed: ${this.formatError(error)}`);
    }
  }

  /**
   * Parse with automatic retry logic
   * Implements exponential backoff for transient failures
   */
  private async parseWithRetry(
    file: Buffer | string,
    options: ReductoParseOptions,
    attempt: number = 1
  ): Promise<ReductoParseResult> {
    const maxAttempts = this.config.retryAttempts!;

    try {
      // Step 1: Upload the file first
      const buffer = typeof file === 'string' ? Buffer.from(file) : file;
      const upload = await this.client.upload({
        file: buffer,
        extension: 'pdf',
      });

      // Step 2: Parse the uploaded file
      const result = await this.client.parse.run({
        input: upload,
        retrieval: {
          chunking_mode: options.chunking_mode || 'page_sections',
        },
        formatting: {
          table_output_format: options.table_output_format || 'markdown',
        },
        settings: {
          ocr_system: options.ocr_system || 'highres',
          page_range: options.page_range,
        },
      });

      // Handle async response (job_id only)
      if ('job_id' in result && !('duration' in result)) {
        throw new Error('Async parsing not supported. Use synchronous parsing.');
      }

      return result as ReductoParseResult;
    } catch (error: any) {
      // Don't retry validation errors (422) - these won't succeed
      if (error.status === 422) {
        console.error('🔴 Reducto: Validation error', error.response?.data);
        throw error;
      }

      // Retry server errors (500, 503) with exponential backoff
      const isRetryable = error.status === 500 || error.status === 503;
      const canRetry = attempt < maxAttempts;

      if (isRetryable && canRetry) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.warn(
          `⚠️  Reducto: Attempt ${attempt}/${maxAttempts} failed, retrying in ${backoffMs}ms...`
        );
        await this.sleep(backoffMs);
        return this.parseWithRetry(file, options, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Extract plain text from Reducto parse result
   * Concatenates all chunks into a single text string
   */
  private extractText(result: any): string {
    // Handle the actual API structure: result.result is either FullResult or URLResult
    const parseResult = result.result;

    // Check if it's a URL result (large response)
    if (parseResult.type === 'url') {
      throw new Error('Response too large - returned as URL. URL fetching not implemented yet.');
    }

    const chunks = parseResult.chunks;

    if (!chunks || chunks.length === 0) {
      return '';
    }

    // Join all chunk content with double newlines
    const text = chunks
      .map((chunk: any) => chunk.content.trim())
      .filter((content: string) => content.length > 0)
      .join('\n\n');

    return text;
  }

  /**
   * Extract structured blocks (useful for advanced features)
   * Returns all blocks across all chunks
   */
  public extractBlocks(result: any) {
    return result.result.chunks.flatMap((chunk: any) => chunk.blocks);
  }

  /**
   * Extract tables specifically (for future table analysis)
   */
  public extractTables(result: any) {
    return this.extractBlocks(result).filter((block: any) => block.type === 'table');
  }

  /**
   * Update internal statistics after successful parse
   */
  private updateStats(result: any, processingTime: number): void {
    this.stats.documentsProcessed++;
    this.stats.totalPages += result.usage?.num_pages || 0;
    this.stats.totalProcessingTime += processingTime;

    if (result.usage?.credits) {
      this.stats.creditsUsed += result.usage.credits;
    }
  }

  /**
   * Get usage statistics
   * Useful for monitoring costs and performance
   */
  public getStats(): ReductoStats {
    return {
      documentsProcessed: this.stats.documentsProcessed,
      creditsUsed: this.stats.creditsUsed,
      totalPages: this.stats.totalPages,
      averageCreditsPerDoc:
        this.stats.documentsProcessed > 0
          ? this.stats.creditsUsed / this.stats.documentsProcessed
          : 0,
      averageProcessingTime:
        this.stats.documentsProcessed > 0
          ? this.stats.totalProcessingTime / this.stats.documentsProcessed
          : 0,
    };
  }

  /**
   * Format error message for logging
   */
  private formatError(error: any): string {
    // Reducto API returns structured errors
    if (error.response?.data?.detail) {
      const details = error.response.data.detail;
      return details.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(', ');
    }

    // Fallback to generic error message
    return error.message || String(error);
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
