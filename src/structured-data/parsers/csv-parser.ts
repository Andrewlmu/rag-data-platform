import Papa from 'papaparse';

export interface ParsedData {
  filename: string;
  headers: string[];
  rows: any[];
  rowCount: number;
  columnCount: number;
  types: string[];
  sampleRows: any[];
}

export async function parseCSV(content: string, filename: string): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      dynamicTyping: false, // We'll do our own type inference
      skipEmptyLines: true,
      complete: results => {
        try {
          const headers = results.meta.fields || [];
          const rows = results.data as any[];

          // Infer types from data
          const types = inferTypes(rows, headers);

          // Get sample rows (first 5 + last 5)
          const sampleRows = [
            ...rows.slice(0, Math.min(5, rows.length)),
            ...(rows.length > 10 ? rows.slice(-5) : []),
          ];

          resolve({
            filename,
            headers,
            rows,
            rowCount: rows.length,
            columnCount: headers.length,
            types,
            sampleRows,
          });
        } catch (error) {
          reject(error);
        }
      },
      error: error => {
        reject(error);
      },
    });
  });
}

function inferTypes(rows: any[], headers: string[]): string[] {
  if (rows.length === 0) {
    return headers.map(() => 'TEXT');
  }

  return headers.map(header => {
    // Sample up to 100 rows for type inference
    const sampleSize = Math.min(100, rows.length);
    const samples = rows.slice(0, sampleSize).map(row => row[header]);

    // Filter out null/undefined/empty values
    const validSamples = samples.filter(val => val !== null && val !== undefined && val !== '');

    if (validSamples.length === 0) {
      return 'TEXT';
    }

    // Check if all values are integers
    const allIntegers = validSamples.every(val => {
      const num = Number(val);
      return !isNaN(num) && Number.isInteger(num) && String(num) === String(val).trim();
    });

    if (allIntegers) {
      return 'INTEGER';
    }

    // Check if all values are floats
    const allFloats = validSamples.every(val => {
      const num = Number(val);
      return !isNaN(num) && String(val).match(/^-?\d+\.?\d*$/);
    });

    if (allFloats) {
      return 'REAL';
    }

    // Check if all values are booleans
    const allBooleans = validSamples.every(
      val => String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'false'
    );

    if (allBooleans) {
      return 'BOOLEAN';
    }

    // Default to TEXT
    return 'TEXT';
  });
}

export function analyzeColumn(rows: any[], header: string): string {
  if (rows.length === 0) {
    return 'No data';
  }

  const values = rows
    .map(row => row[header])
    .filter(val => val !== null && val !== undefined && val !== '');

  if (values.length === 0) {
    return 'All NULL';
  }

  // Get unique values
  const uniqueValues = [...new Set(values)];

  // If numeric, show range
  if (values.every(v => !isNaN(Number(v)))) {
    const numbers = values.map(v => Number(v));
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    return `range ${min} - ${max}`;
  }

  // If categorical with few unique values, list them
  if (uniqueValues.length <= 5) {
    return `values: ${uniqueValues.join(', ')}`;
  }

  // Otherwise, show unique count
  return `${uniqueValues.length} unique values`;
}
