import * as crypto from 'crypto';
import * as fs from 'fs';
import { Database } from 'duckdb-async';

export interface FileRecord {
  filepath: string;
  hash: string;
  lastModified: Date;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  processedAt?: Date;
  errorMessage?: string;
}

export class FileTracker {
  private db: Database;
  private tableName = '_file_tracking_metadata';

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Initialize tracking table
   */
  async initialize(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        filepath VARCHAR PRIMARY KEY,
        hash VARCHAR NOT NULL,
        last_modified TIMESTAMP NOT NULL,
        file_size BIGINT NOT NULL,
        status VARCHAR NOT NULL,
        processed_at TIMESTAMP,
        error_message VARCHAR
      )
    `);
    console.log('✅ File tracking table initialized');
  }

  /**
   * Calculate SHA-256 hash of file
   */
  async calculateFileHash(filepath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filepath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Check if file needs processing
   * Returns true if file is new or has been modified
   */
  async needsProcessing(filepath: string): Promise<boolean> {
    try {
      const stats = fs.statSync(filepath);
      const currentHash = await this.calculateFileHash(filepath);

      const result = await this.db.all(
        `
        SELECT hash, status
        FROM ${this.tableName}
        WHERE filepath = ?
      `,
        filepath
      );

      // File not in database - needs processing
      if (result.length === 0) {
        console.log(`📄 New file detected: ${filepath}`);
        return true;
      }

      const record = result[0];

      // File hash changed - needs reprocessing
      if (record.hash !== currentHash) {
        console.log(`🔄 File modified: ${filepath}`);
        return true;
      }

      // File previously failed - needs reprocessing
      if (record.status === 'error') {
        console.log(`⚠️  Retrying failed file: ${filepath}`);
        return true;
      }

      // File already processed successfully
      console.log(`✓ Skipping already-processed file: ${filepath}`);
      return false;
    } catch (error) {
      console.error(`Error checking file ${filepath}:`, error);
      return true; // Process on error to be safe
    }
  }

  /**
   * Mark file as being processed
   */
  async markProcessing(filepath: string): Promise<void> {
    const stats = fs.statSync(filepath);
    const hash = await this.calculateFileHash(filepath);

    await this.db.run(
      `
      INSERT OR REPLACE INTO ${this.tableName}
      (filepath, hash, last_modified, file_size, status)
      VALUES (?, ?, ?, ?, 'processing')
    `,
      filepath,
      hash,
      stats.mtime,
      stats.size
    );
  }

  /**
   * Mark file as successfully processed
   */
  async markCompleted(filepath: string): Promise<void> {
    await this.db.run(
      `
      UPDATE ${this.tableName}
      SET status = 'completed', processed_at = CURRENT_TIMESTAMP
      WHERE filepath = ?
    `,
      filepath
    );
  }

  /**
   * Mark file as failed
   */
  async markError(filepath: string, errorMessage: string): Promise<void> {
    await this.db.run(
      `
      UPDATE ${this.tableName}
      SET status = 'error',
          error_message = ?,
          processed_at = CURRENT_TIMESTAMP
      WHERE filepath = ?
    `,
      errorMessage,
      filepath
    );
  }

  /**
   * Get processing statistics
   */
  async getStats(): Promise<{ total: number; completed: number; error: number; pending: number }> {
    const result = await this.db.all(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM ${this.tableName}
    `);

    return result[0] || { total: 0, completed: 0, error: 0, pending: 0 };
  }
}
