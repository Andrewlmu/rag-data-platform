/**
 * Auto-loader for demo/sample data on server startup
 * Automatically loads files from specified directory
 * With persistence support: skips already-processed files
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { DataProcessor } from '../services/dataProcessor';
import type { DocumentParser } from '../services/documentParser';
import { FileTracker } from '../services/fileTracker';
import type { Database } from 'duckdb-async';

export class AutoLoader {
  private fileTracker: FileTracker | null = null;

  constructor(
    private dataProcessor: DataProcessor,
    private documentParser: DocumentParser
  ) {}

  /**
   * Initialize file tracker if persistence is enabled
   */
  async initialize(db: Database): Promise<void> {
    if (process.env.ENABLE_PERSISTENCE === 'true') {
      this.fileTracker = new FileTracker(db);
      await this.fileTracker.initialize();
      console.log('💾 File tracker initialized for smart loading');
    }
  }

  /**
   * Auto-load all files from a directory on startup
   */
  async loadFromDirectory(directoryPath: string): Promise<void> {
    try {
      const fullPath = path.resolve(directoryPath);

      console.log(`\n📂 Auto-loading demo data from: ${fullPath}`);

      // Check if directory exists
      try {
        await fs.access(fullPath);
      } catch {
        console.log(`⚠️  Directory not found: ${fullPath}`);
        console.log(`   Skipping auto-load. To enable, create the directory and add files.`);
        return;
      }

      // Read all files in directory
      const files = await fs.readdir(fullPath);

      if (files.length === 0) {
        console.log(`📭 No files found in ${directoryPath}`);
        return;
      }

      console.log(`📄 Found ${files.length} file(s) to load`);
      console.log(`🔍 Files found:`, files.sort());

      let processedCount = 0;
      let skippedCount = 0;

      // Process each file
      for (const filename of files) {
        // Skip hidden files and directories
        if (filename.startsWith('.')) {
          skippedCount++;
          continue;
        }

        const filePath = path.join(fullPath, filename);

        try {
          // Check if it's a file (not directory)
          const stats = await fs.stat(filePath);
          if (!stats.isFile()) {
            skippedCount++;
            continue;
          }

          // Check if file needs processing (if file tracker is enabled)
          if (this.fileTracker) {
            const needsProcessing = await this.fileTracker.needsProcessing(filePath);
            if (!needsProcessing) {
              skippedCount++;
              continue; // Skip this file
            }

            // Mark as processing
            await this.fileTracker.markProcessing(filePath);
          }

          // Read file content and strip BOM if present
          let content = await fs.readFile(filePath, 'utf-8');

          // Remove UTF-8 BOM if present
          if (content.charCodeAt(0) === 0xfeff) {
            content = content.slice(1);
            console.log(`  🔧 Removed UTF-8 BOM from ${filename}`);
          }

          // Determine file type
          const ext = path.extname(filename).toLowerCase();
          let type = 'txt';
          if (ext === '.csv') type = 'csv';
          else if (ext === '.pdf') type = 'pdf';
          else if (ext === '.txt') type = 'txt';
          else if (ext === '.md') type = 'markdown';

          console.log(`  📝 Processing ${filename} (${type}, ${content.length} bytes)...`);

          // Process through document processor
          const doc = {
            id: `demo_${Date.now()}_${filename}`,
            content,
            metadata: {
              filename,
              type,
              size: content.length,
              uploadedAt: new Date().toISOString(),
              source: 'auto-loaded-demo',
            },
            chunks: [], // Will be populated during processing
          };

          console.log(`  ⚙️  Calling processDocument for ${filename}...`);
          await this.dataProcessor.processDocument(doc);
          console.log(`  ✅ processDocument completed for ${filename}`);

          // Mark as completed
          if (this.fileTracker) {
            await this.fileTracker.markCompleted(filePath);
          }

          processedCount++;
          console.log(`  ✅ Loaded: ${filename} (${type})`);
        } catch (error: any) {
          // Mark as error
          if (this.fileTracker) {
            await this.fileTracker.markError(filePath, error.message);
          }
          console.error(`  ❌ Failed to load ${filename}:`, error.message);
        }
      }

      console.log(
        `\n📊 Auto-load complete: ${processedCount} processed, ${skippedCount} skipped`
      );

      // Save vector cache after batch loading
      if (processedCount > 0) {
        console.log('💾 Saving vector cache...');
        const vectorSearch = this.dataProcessor.getVectorSearch();
        if (vectorSearch && typeof vectorSearch.saveCacheNow === 'function') {
          await vectorSearch.saveCacheNow();
          console.log('✅ Vector cache saved\n');
        }
      }
    } catch (error: any) {
      console.error('❌ Auto-load failed:', error.message);
    }
  }

  /**
   * Load files based on environment configuration
   */
  async autoLoadDemoData(): Promise<void> {
    const autoLoadEnabled = process.env.AUTO_LOAD_DEMO_DATA !== 'false'; // Default: enabled
    const demoDataPath = process.env.DEMO_DATA_PATH || 'data/demo';

    if (!autoLoadEnabled) {
      console.log('ℹ️  Auto-load disabled (AUTO_LOAD_DEMO_DATA=false)');
      return;
    }

    await this.loadFromDirectory(demoDataPath);
  }
}
