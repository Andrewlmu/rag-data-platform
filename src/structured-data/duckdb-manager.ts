import { Database } from 'duckdb-async';
import { ParsedData } from './parsers/csv-parser.js';
import * as fs from 'fs';
import * as path from 'path';

export interface QueryResult {
  success: boolean;
  results?: any[];
  rowCount?: number;
  error?: string;
}

export class DuckDBManager {
  private db: Database | null = null;
  private tables: Map<string, TableInfo> = new Map();

  async initialize() {
    console.log('🦆 Initializing DuckDB...');

    const enablePersistence = process.env.ENABLE_PERSISTENCE === 'true';
    const duckdbPath = process.env.DUCKDB_PATH || './data/duckdb.db';

    if (enablePersistence) {
      // Ensure directory exists
      const dbDir = path.dirname(duckdbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`📁 Created DuckDB directory: ${dbDir}`);
      }

      this.db = await Database.create(duckdbPath);
      console.log(`💾 DuckDB initialized (persistent): ${duckdbPath}`);
    } else {
      this.db = await Database.create(':memory:');
      console.log('🔄 DuckDB initialized (in-memory)');
    }
  }

  async createTable(data: ParsedData): Promise<string> {
    if (!this.db) {
      throw new Error('DuckDB not initialized');
    }

    const tableName = sanitizeTableName(data.filename);

    // Generate CREATE TABLE statement
    const columns = data.headers
      .map((header, i) => {
        const type = data.types[i];
        return `"${header}" ${type}`;
      })
      .join(', ');

    const createSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;

    console.log(`🔨 Creating table: ${tableName}`);
    console.log(`   Columns: ${data.headers.join(', ')}`);

    await this.db.exec(createSQL);

    // Insert rows
    if (data.rows.length > 0) {
      await this.insertRows(tableName, data);
    }

    // Store table info
    this.tables.set(tableName, {
      name: tableName,
      filename: data.filename,
      headers: data.headers,
      types: data.types,
      rowCount: data.rowCount,
    });

    console.log(`✅ Table created: ${tableName} (${data.rowCount} rows)`);

    return tableName;
  }

  private async insertRows(tableName: string, data: ParsedData) {
    if (!this.db) {
      throw new Error('DuckDB not initialized');
    }

    // Prepare insert statement
    const placeholders = data.headers.map(() => '?').join(', ');
    const insertSQL = `INSERT INTO ${tableName} VALUES (${placeholders})`;

    // Prepare statement
    const stmt = await this.db.prepare(insertSQL);

    // Insert rows in batches
    const batchSize = 100;
    for (let i = 0; i < data.rows.length; i += batchSize) {
      const batch = data.rows.slice(i, i + batchSize);

      for (const row of batch) {
        const values = data.headers.map(header => {
          const value = row[header];
          // Handle empty strings and null values
          if (value === null || value === undefined || value === '') {
            return null;
          }
          return value;
        });

        await stmt.run(...values);
      }
    }

    await stmt.finalize();
  }

  async query(sql: string): Promise<QueryResult> {
    if (!this.db) {
      return { success: false, error: 'DuckDB not initialized' };
    }

    try {
      // Validate SQL (basic safety check)
      if (!isValidSQL(sql)) {
        return { success: false, error: 'Invalid or unsafe SQL query' };
      }

      console.log(`🔍 Executing SQL: ${sql.substring(0, 100)}...`);

      const results = await this.db.all(sql);

      console.log(`✅ Query returned ${results.length} rows`);

      return {
        success: true,
        results,
        rowCount: results.length,
      };
    } catch (error: any) {
      console.error(`❌ Query error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  getTableInfo(tableName: string): TableInfo | undefined {
    return this.tables.get(tableName);
  }

  getAllTables(): TableInfo[] {
    return Array.from(this.tables.values());
  }

  getDatabase(): Database | null {
    return this.db;
  }

  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
      console.log('🦆 DuckDB closed');
    }
  }
}

interface TableInfo {
  name: string;
  filename: string;
  headers: string[];
  types: string[];
  rowCount: number;
}

function sanitizeTableName(filename: string): string {
  // Remove file extension
  let name = filename.replace(/\.(csv|xlsx|xls)$/i, '');

  // Replace spaces and special characters with underscores
  name = name.replace(/[^a-zA-Z0-9]/g, '_');

  // Ensure it doesn't start with a number
  if (/^\d/.test(name)) {
    name = 'table_' + name;
  }

  // Convert to lowercase
  name = name.toLowerCase();

  return name;
}

function isValidSQL(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();

  // Allow SELECT and WITH (for CTEs) statements
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    return false;
  }

  // Block dangerous keywords (excluding CREATE since CTEs use "WITH ... AS" which is safe)
  const dangerous = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'TRUNCATE', 'EXEC'];
  for (const keyword of dangerous) {
    if (normalized.includes(keyword)) {
      return false;
    }
  }

  return true;
}
