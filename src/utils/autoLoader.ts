/**
 * Auto-loader for demo/sample data on server startup
 * Automatically loads files from specified directory
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { DataProcessor } from '../services/dataProcessor';
import type { DocumentParser } from '../services/documentParser';

export class AutoLoader {
  constructor(
    private dataProcessor: DataProcessor,
    private documentParser: DocumentParser
  ) {}

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

      let loaded = 0;
      let skipped = 0;

      // Process each file
      for (const filename of files) {
        // Skip hidden files and directories
        if (filename.startsWith('.')) {
          skipped++;
          continue;
        }

        const filePath = path.join(fullPath, filename);

        try {
          // Check if it's a file (not directory)
          const stats = await fs.stat(filePath);
          if (!stats.isFile()) {
            skipped++;
            continue;
          }

          // Read file content
          const content = await fs.readFile(filePath, 'utf-8');

          // Determine file type
          const ext = path.extname(filename).toLowerCase();
          let type = 'txt';
          if (ext === '.csv') type = 'csv';
          else if (ext === '.pdf') type = 'pdf';
          else if (ext === '.txt') type = 'txt';
          else if (ext === '.md') type = 'markdown';

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

          await this.dataProcessor.processDocument(doc);
          loaded++;
          console.log(`  ✅ Loaded: ${filename} (${type})`);
        } catch (error: any) {
          console.error(`  ❌ Failed to load ${filename}:`, error.message);
          skipped++;
        }
      }

      console.log(`\n📊 Auto-load complete: ${loaded} loaded, ${skipped} skipped\n`);
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
