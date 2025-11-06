# Reducto API Documentation

**Indexed on:** 2025-11-05
**Base URL:** https://platform.reducto.ai
**Studio Dashboard:** https://studio.reducto.ai/

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Parse Endpoint (Primary)](#parse-endpoint-primary)
5. [Upload Endpoint](#upload-endpoint)
6. [Request/Response Format](#requestresponse-format)
7. [Error Handling](#error-handling)
8. [Best Practices for Integration](#best-practices-for-integration)
9. [TypeScript Integration Examples](#typescript-integration-examples)

---

## Overview

Reducto is a document processing platform that converts unstructured data (PDFs, images, spreadsheets) into structured JSON suitable for LLM pipelines and automation workflows.

### Core Capabilities
- **Parse** – Transforms documents into text, tables, and figures
- **Extract** – Generates structured JSON using schemas or prompts
- **Split** – Segments large documents with table of contents generation
- **Edit** – Automates form completion for PDFs and DOCX files

### Industry Applications
- Financial institutions (statements, reports, transaction logs)
- Insurance (claims, policies, invoices)
- Healthcare (patient records, lab reports)
- Legal (patents, transcripts, contracts)
- Human resources (payroll, resumes, onboarding)

---

## Authentication

### Obtaining API Keys
1. Visit the Studio Dashboard: https://studio.reducto.ai/
2. Navigate to the "API Keys" section in your account
3. Generate or copy your API key

### Using Authentication
Reducto uses HTTP Bearer token authentication. Include your API key in all requests:

**Header Format:**
```
Authorization: Bearer YOUR_API_KEY
```

**Security Notes:**
- Store API keys securely (use environment variables)
- Never commit keys to version control
- The authentication scheme is labeled "SkippableHTTPBearer" in the API spec, suggesting some endpoints may have optional auth, but always include it for production use

---

## API Endpoints

### Base URL
```
https://platform.reducto.ai
```

### Primary Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/upload` | POST | Upload files for processing |
| `/parse` | POST | Parse documents into structured data |
| `/extract` | POST | Extract structured JSON from documents |
| `/split` | POST | Split documents into sections |
| `/edit` | POST | Automate form completion |

---

## Parse Endpoint (Primary)

### Endpoint Details
- **URL:** `https://platform.reducto.ai/parse`
- **Method:** POST
- **Content-Type:** application/json
- **Authentication:** Required (Bearer token)

### Processing Modes

**Synchronous Mode (Default)**
- Returns results immediately in the response
- Best for smaller documents or real-time processing
- Returns full result in response body

**Asynchronous Mode**
- Returns job_id immediately
- Results delivered via webhook or polling
- Best for large documents or batch processing
- Supports priority levels and custom metadata

### Request Parameters

#### Core Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | string \| UploadResponse | Yes | Document URL (public, S3 presigned, reducto://, or jobid://) |
| `enhance` | object | No | Vision model enhancements |
| `retrieval` | object | No | Chunking strategy and embeddings |
| `formatting` | object | No | Output format configuration |
| `spreadsheet` | object | No | Table handling options |
| `settings` | object | No | OCR, timeouts, page ranges |
| `async` | object | No | Webhook config, priority, metadata |

#### Input Parameter Options
```typescript
// Public URL
input: "https://example.com/document.pdf"

// Upload response from /upload endpoint
input: "reducto://file_id_from_upload"

// Result from previous parse job
input: "jobid://previous_job_id"

// S3 presigned URL
input: "https://bucket.s3.amazonaws.com/file?signature=..."
```

#### Enhancement Options (`enhance`)
```typescript
{
  "agentic": [],  // Array of agentic analysis options
  "summarize_figures": true  // Enable figure summarization
}
```

#### Retrieval Options (`retrieval`)
```typescript
{
  "chunking": {
    "chunk_mode": "disabled" | "variable" | "section" | "page" | "block" | "page_sections"
  },
  "filter_blocks": [],  // Array of block types to filter
  "embedding_optimized": false  // Optimize for embeddings
}
```

#### Formatting Options (`formatting`)
```typescript
{
  "add_page_markers": false,  // Include page markers in output
  "table_output_format": "dynamic" | "html" | "json" | "markdown" | "csv",
  "merge_tables": false,  // Merge adjacent tables
  "include": []  // Array of content types to include
}
```

#### Spreadsheet Options (`spreadsheet`)
```typescript
{
  "split_large_tables": {
    "enabled": true,
    "size": 50  // Max rows per split
  },
  "clustering": "accurate" | "fast"  // Cell clustering strategy
}
```

#### Settings Options (`settings`)
```typescript
{
  "ocr_system": "standard" | "advanced",
  "force_url_result": false,  // Force result as presigned URL
  "timeout": 300,  // Timeout in seconds (optional)
  "document_password": "password",  // For password-protected docs
  "page_range": [1, 10],  // Process specific pages
  "return_images": true  // Include images in response
}
```

#### Async Options (`async`)
```typescript
{
  "webhook": {
    "url": "https://your-server.com/webhook",
    "type": "svix" | "direct"
  },
  "priority": "high" | "normal" | "low",
  "metadata": {
    "custom_field": "value"
  }
}
```

### Response Format

#### Synchronous Response (200 OK)
```typescript
{
  "job_id": "string",
  "duration": 12.5,  // seconds
  "usage": {
    "num_pages": 10,
    "credits": 10  // Optional
  },
  "result": {
    "type": "full" | "url",
    "chunks": [
      {
        "content": "string",
        "embedding": [0.1, 0.2, ...],  // Optional
        "blocks": [
          {
            "type": "Header" | "Text" | "Table" | "Figure" | "Caption",
            "bbox": {
              "left": 100,
              "top": 200,
              "width": 300,
              "height": 50,
              "page": 1
            },
            "content": "string",
            "confidence": "high" | "medium" | "low",
            "ocr_confidence": 0.95  // 0-1 when OCR is enabled
          }
        ]
      }
    ]
  },
  "pdf_url": "https://...",  // Optional converted PDF URL
  "studio_link": "https://studio.reducto.ai/..."  // Optional debug link
}
```

**Important Notes:**
- Results exceeding HTTPS size limits return as `type: "url"` with a presigned URL
- Client must download the result from the presigned URL in this case
- OCR confidence scores range from 0 to 1 (higher is better)
- Bounding boxes enable spatial document understanding

#### Asynchronous Response (200 OK)
```typescript
{
  "job_id": "string"
}
```

Use this `job_id` to:
- Poll for results
- Receive webhook notifications
- Reference in subsequent API calls

---

## Upload Endpoint

### Endpoint Details
- **URL:** `https://platform.reducto.ai/upload`
- **Method:** POST
- **Content-Type:** multipart/form-data
- **Authentication:** Required (Bearer token)

### Request Format
```typescript
// multipart/form-data
{
  file: <binary data>,
  extension?: "pdf" | "docx" | "jpg" | ...  // Optional query parameter
}
```

### Response Format (200 OK)
```typescript
{
  "file_id": "string",  // Use as "reducto://file_id" in parse requests
  "presigned_url": "string" | null  // Optional URL for file access
}
```

### Supported Formats
The documentation mentions support for:
- PDFs
- Images (JPG, PNG, etc.)
- Spreadsheets (XLSX)
- Word Documents (DOCX)

**Note:** Specific file size limits are not documented in the API reference.

---

## Request/Response Format

### Standard HTTP Headers
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json  // For parse/extract endpoints
Content-Type: multipart/form-data  // For upload endpoint
```

### Block Types
Documents are parsed into various block types:

| Block Type | Description |
|------------|-------------|
| `Header` | Headings and titles |
| `Text` | Body text paragraphs |
| `Table` | Tabular data |
| `Figure` | Images, charts, diagrams |
| `Caption` | Image/table captions |

### Confidence Levels
- `high` – High confidence in extraction
- `medium` – Medium confidence
- `low` – Low confidence, manual review recommended

### Bounding Box Format
Each block includes spatial coordinates:
```typescript
{
  "left": number,    // X coordinate from left edge
  "top": number,     // Y coordinate from top edge
  "width": number,   // Width in pixels
  "height": number,  // Height in pixels
  "page": number     // Page number (1-indexed)
}
```

---

## Error Handling

### HTTP Status Codes

| Status | Meaning | Response Type |
|--------|---------|---------------|
| 200 | Success | ParseResponse or AsyncParseResponse |
| 422 | Validation Error | HTTPValidationError |
| 404 | Not Found | Standard error response |
| 401 | Unauthorized | Authentication failure |
| 500 | Server Error | Internal error |

### Validation Error Format (422)
```typescript
{
  "detail": [
    {
      "loc": ["body", "input"],  // Location of error
      "msg": "field required",    // Error message
      "type": "value_error.missing"  // Error type
    }
  ]
}
```

### Common Error Types
- `value_error.missing` – Required field not provided
- `value_error.str` – Invalid string format
- `value_error.number` – Invalid number format
- `type_error` – Wrong data type

### Error Handling Best Practices

1. **Always check HTTP status codes**
```typescript
if (response.status === 422) {
  // Handle validation errors
  const errors = await response.json();
  errors.detail.forEach(error => {
    console.error(`Validation error at ${error.loc.join('.')}: ${error.msg}`);
  });
}
```

2. **Implement retry logic for transient failures**
```typescript
async function parseWithRetry(input: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('https://platform.reducto.ai/parse', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input })
      });

      if (response.ok) {
        return await response.json();
      }

      if (response.status === 422) {
        // Don't retry validation errors
        throw new Error('Validation error');
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

3. **Handle large responses**
```typescript
if (result.type === 'url') {
  // Download result from presigned URL
  const fullResult = await fetch(result.url).then(r => r.json());
}
```

---

## Best Practices for Integration

### 1. File Upload Strategy

**For Small Documents (<5MB):**
- Use direct parse with public URL or S3 presigned URL
```typescript
await client.parse.run({ input: 'https://example.com/doc.pdf' });
```

**For Large Documents or Private Files:**
- Upload first, then parse
```typescript
const upload = await client.upload({ file: fs.createReadStream('doc.pdf') });
await client.parse.run({ input: upload });
```

### 2. Processing Mode Selection

**Use Synchronous Mode When:**
- Document is < 20 pages
- Need immediate response
- Processing in real-time user flow

**Use Asynchronous Mode When:**
- Document is > 20 pages
- Batch processing multiple documents
- Can handle webhook callbacks
- Need to set priority levels

### 3. Chunking Strategy

**Recommended chunking modes by use case:**

| Use Case | Chunk Mode | Reason |
|----------|------------|--------|
| RAG/Embeddings | `page_sections` | Preserves semantic boundaries |
| Full text extraction | `disabled` | Get complete document text |
| Section-based analysis | `section` | Organized by document structure |
| Page-by-page processing | `page` | One chunk per page |
| Fine-grained control | `block` | Individual text blocks |

### 4. Table Handling

**For Complex Spreadsheets:**
```typescript
{
  spreadsheet: {
    split_large_tables: {
      enabled: true,
      size: 50  // Adjust based on table complexity
    },
    clustering: "accurate"  // Use "fast" for simpler tables
  }
}
```

**Choose Table Output Format:**
- `dynamic` – Auto-detect best format
- `html` – For web display
- `json` – For programmatic access
- `markdown` – For LLM prompts
- `csv` – For data analysis

### 5. OCR Configuration

**When to Use Advanced OCR:**
- Scanned documents
- Low-quality images
- Handwritten text
- Complex layouts

```typescript
{
  settings: {
    ocr_system: "advanced",
    return_images: true  // Include images for verification
  }
}
```

### 6. Performance Optimization

**Reduce Processing Time:**
```typescript
{
  retrieval: {
    embedding_optimized: false  // Disable if not using embeddings
  },
  enhance: {
    summarize_figures: false  // Disable if not needed
  },
  settings: {
    page_range: [1, 50]  // Process only needed pages
  }
}
```

**Set Appropriate Timeouts:**
```typescript
{
  settings: {
    timeout: 300  // 5 minutes for large documents
  }
}
```

### 7. Credit Management

**Monitor Usage:**
```typescript
const result = await client.parse.run({ input });
console.log(`Pages processed: ${result.usage.num_pages}`);
console.log(`Credits used: ${result.usage.credits}`);
```

**Optimize Credit Usage:**
- Process only necessary pages with `page_range`
- Use appropriate OCR level (standard vs advanced)
- Disable unnecessary enhancements

### 8. Error Recovery

**Implement Robust Error Handling:**
```typescript
try {
  const result = await client.parse.run({ input });
  return result;
} catch (error) {
  if (error.status === 422) {
    // Log validation errors for debugging
    console.error('Validation errors:', error.body);
  } else if (error.status === 500) {
    // Retry on server errors
    return await retryWithBackoff(input);
  }
  throw error;
}
```

### 9. Password-Protected Documents

```typescript
{
  settings: {
    document_password: process.env.DOC_PASSWORD
  }
}
```

### 10. Testing in Studio

**Before Integration:**
1. Test document parsing in Studio: https://studio.reducto.ai/
2. Experiment with different configurations
3. Note optimal settings for your document type
4. Use Studio links in API responses for debugging

---

## TypeScript Integration Examples

### Setup and Installation

```bash
npm install reductoai
# or
yarn add reductoai
```

### Basic Configuration

```typescript
import { Reducto } from 'reductoai';
import * as fs from 'fs';

const client = new Reducto({
  apiKey: process.env.REDUCTO_API_KEY || 'your-api-key'
});
```

### Example 1: Simple PDF Parsing

```typescript
async function parsePDF(filePath: string) {
  try {
    // Upload file
    const upload = await client.upload({
      file: fs.createReadStream(filePath)
    });

    // Parse document
    const result = await client.parse.run({
      input: upload
    });

    console.log(`Processed ${result.usage.num_pages} pages`);

    // Access chunks
    result.result.chunks.forEach((chunk, index) => {
      console.log(`\nChunk ${index + 1}:`);
      console.log(chunk.content);
    });

    return result;
  } catch (error) {
    console.error('Parse error:', error);
    throw error;
  }
}
```

### Example 2: Advanced Configuration for Financial Documents

```typescript
async function parseFinancialStatement(url: string) {
  const result = await client.parse.run({
    input: url,

    // Extract tables accurately
    formatting: {
      table_output_format: 'json',
      merge_tables: true,
      add_page_markers: true
    },

    // Optimize for structured data extraction
    retrieval: {
      chunking: {
        chunk_mode: 'section'
      },
      embedding_optimized: false
    },

    // Enhanced table handling
    spreadsheet: {
      split_large_tables: {
        enabled: true,
        size: 100
      },
      clustering: 'accurate'
    },

    // Use advanced OCR for scanned statements
    settings: {
      ocr_system: 'advanced',
      timeout: 300
    }
  });

  return result;
}
```

### Example 3: Async Processing with TypeScript

```typescript
interface AsyncParseOptions {
  input: string;
  webhookUrl: string;
  metadata?: Record<string, any>;
}

async function parseAsync(options: AsyncParseOptions) {
  const response = await client.parse.run({
    input: options.input,

    // Enable async mode
    async: {
      webhook: {
        url: options.webhookUrl,
        type: 'direct'
      },
      priority: 'normal',
      metadata: options.metadata
    }
  });

  console.log(`Job queued: ${response.job_id}`);
  return response.job_id;
}

// Webhook handler (Express example)
import express from 'express';

const app = express();
app.use(express.json());

app.post('/webhook/reducto', async (req, res) => {
  const result = req.body;

  console.log(`Job ${result.job_id} completed`);
  console.log(`Pages: ${result.usage.num_pages}`);

  // Process result
  await processParseResult(result);

  res.status(200).send('OK');
});
```

### Example 4: Type-Safe Response Handling

```typescript
interface ParseBlock {
  type: 'Header' | 'Text' | 'Table' | 'Figure' | 'Caption';
  content: string;
  bbox: {
    left: number;
    top: number;
    width: number;
    height: number;
    page: number;
  };
  confidence?: 'high' | 'medium' | 'low';
  ocr_confidence?: number;
}

interface ParseChunk {
  content: string;
  embedding?: number[];
  blocks: ParseBlock[];
}

interface ParseResult {
  job_id: string;
  duration: number;
  usage: {
    num_pages: number;
    credits?: number;
  };
  result: {
    type: 'full' | 'url';
    chunks: ParseChunk[];
  };
  pdf_url?: string;
  studio_link?: string;
}

async function parseWithTypes(input: string): Promise<ParseResult> {
  const result = await client.parse.run({ input });

  // TypeScript knows the structure now
  result.result.chunks.forEach(chunk => {
    chunk.blocks.forEach(block => {
      if (block.type === 'Table') {
        console.log('Found table on page', block.bbox.page);
      }
    });
  });

  return result as ParseResult;
}
```

### Example 5: RAG Preparation with Embeddings

```typescript
async function prepareForRAG(filePath: string) {
  const upload = await client.upload({
    file: fs.createReadStream(filePath)
  });

  const result = await client.parse.run({
    input: upload,

    // Optimize for RAG
    retrieval: {
      chunking: {
        chunk_mode: 'page_sections'
      },
      embedding_optimized: true
    },

    // Clean formatting for LLMs
    formatting: {
      table_output_format: 'markdown',
      add_page_markers: true
    }
  });

  // Prepare chunks for vector database
  const vectorChunks = result.result.chunks.map((chunk, index) => ({
    id: `${result.job_id}_${index}`,
    content: chunk.content,
    embedding: chunk.embedding,
    metadata: {
      job_id: result.job_id,
      chunk_index: index,
      source: filePath
    }
  }));

  return vectorChunks;
}
```

### Example 6: Batch Processing

```typescript
async function batchParse(files: string[]) {
  const jobIds: string[] = [];

  // Upload and queue all files
  for (const file of files) {
    const upload = await client.upload({
      file: fs.createReadStream(file)
    });

    const response = await client.parse.run({
      input: upload,
      async: {
        webhook: {
          url: 'https://your-server.com/webhook',
          type: 'direct'
        },
        metadata: {
          filename: file
        }
      }
    });

    jobIds.push(response.job_id);
  }

  console.log(`Queued ${jobIds.length} jobs`);
  return jobIds;
}
```

### Example 7: Error Handling with Custom Types

```typescript
class ReductoError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ReductoError';
  }
}

async function parseWithErrorHandling(input: string) {
  try {
    const result = await client.parse.run({ input });
    return result;
  } catch (error: any) {
    if (error.status === 422) {
      throw new ReductoError(
        'Validation error',
        422,
        error.body?.detail
      );
    }

    if (error.status === 401) {
      throw new ReductoError(
        'Authentication failed. Check API key.',
        401
      );
    }

    if (error.status >= 500) {
      // Retry on server errors
      console.log('Server error, retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await parseWithErrorHandling(input);
    }

    throw new ReductoError(
      'Unknown error',
      error.status || 500,
      error
    );
  }
}
```

### Example 8: Progress Tracking for Large Documents

```typescript
async function parseWithProgress(
  filePath: string,
  onProgress?: (status: string) => void
) {
  try {
    onProgress?.('Uploading file...');
    const upload = await client.upload({
      file: fs.createReadStream(filePath)
    });

    onProgress?.('File uploaded, starting parse...');
    const result = await client.parse.run({
      input: upload,
      settings: {
        timeout: 600  // 10 minutes
      }
    });

    onProgress?.(`Parse complete: ${result.usage.num_pages} pages processed`);
    return result;
  } catch (error) {
    onProgress?.('Parse failed');
    throw error;
  }
}

// Usage
await parseWithProgress('large-document.pdf', (status) => {
  console.log(status);
});
```

### Example 9: Caching Results

```typescript
import * as crypto from 'crypto';
import * as fs from 'fs';

class ReductoCache {
  private cacheDir: string;

  constructor(cacheDir: string = './cache') {
    this.cacheDir = cacheDir;
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  }

  private getCacheKey(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex');
  }

  async parseWithCache(input: string, options: any = {}) {
    const cacheKey = this.getCacheKey(input);
    const cachePath = `${this.cacheDir}/${cacheKey}.json`;

    // Check cache
    if (fs.existsSync(cachePath)) {
      console.log('Cache hit');
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    }

    // Parse and cache
    console.log('Cache miss, parsing...');
    const client = new Reducto({ apiKey: process.env.REDUCTO_API_KEY! });
    const result = await client.parse.run({ input, ...options });

    fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
    return result;
  }
}

// Usage
const cache = new ReductoCache();
const result = await cache.parseWithCache('https://example.com/doc.pdf');
```

### Example 10: Integration with Express Backend

```typescript
import express from 'express';
import multer from 'multer';
import { Reducto } from 'reductoai';

const app = express();
const upload = multer({ dest: 'uploads/' });
const client = new Reducto({ apiKey: process.env.REDUCTO_API_KEY! });

// Parse uploaded file
app.post('/api/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to Reducto
    const uploadResult = await client.upload({
      file: fs.createReadStream(req.file.path)
    });

    // Parse document
    const parseResult = await client.parse.run({
      input: uploadResult,
      formatting: {
        table_output_format: req.body.tableFormat || 'json'
      }
    });

    // Clean up
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      job_id: parseResult.job_id,
      pages: parseResult.usage.num_pages,
      chunks: parseResult.result.chunks
    });
  } catch (error: any) {
    console.error('Parse error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Parse from URL
app.post('/api/parse-url', express.json(), async (req, res) => {
  try {
    const { url, options } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL required' });
    }

    const result = await client.parse.run({
      input: url,
      ...options
    });

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## Rate Limits and Pricing

**Note:** Rate limits and detailed pricing information are not documented in the public API reference.

### What We Know:
- Credit usage is tracked per request in the `usage.credits` field
- Page count is provided in the `usage.num_pages` field
- No documented rate limits or quota restrictions

### Recommendations:
1. Contact Reducto support (support@reducto.ai) for:
   - Rate limit details
   - Pricing per credit/page
   - Enterprise plans
   - Volume discounts

2. Monitor usage in your Studio dashboard
3. Implement exponential backoff for potential rate limiting
4. Consider async processing for high-volume applications

---

## Additional Resources

- **Studio Dashboard:** https://studio.reducto.ai/
- **Main Documentation:** https://docs.reducto.ai/
- **Support Email:** support@reducto.ai
- **Parse Endpoint Docs:** https://docs.reducto.ai/api-reference/parse
- **Upload Endpoint Docs:** https://docs.reducto.ai/api-reference/upload

---

## Summary

### Authentication Method
- HTTP Bearer token authentication
- API keys obtained from Studio dashboard (https://studio.reducto.ai/)
- Include in header: `Authorization: Bearer YOUR_API_KEY`

### Parse Endpoint Structure
- **URL:** POST https://platform.reducto.ai/parse
- **Modes:** Synchronous (default) or Asynchronous
- **Input:** URL, file_id, or previous job_id
- **Configuration:** Highly customizable with enhance, retrieval, formatting, spreadsheet, and settings options

### Request/Response Format
- **Request:** JSON body with flexible configuration options
- **Response:** Structured JSON with chunks containing content, blocks, and bounding boxes
- **Block Types:** Header, Text, Table, Figure, Caption
- **Large Results:** Returned as presigned URLs when exceeding size limits

### Error Handling Patterns
- **422:** Validation errors with detailed location and message
- **401:** Authentication failures
- **500:** Server errors (implement retry logic)
- Detailed error objects with `loc`, `msg`, and `type` fields

### Best Practices for Integration
1. **Use upload endpoint for private/large files**
2. **Choose appropriate processing mode** (sync vs async)
3. **Optimize chunking strategy** for your use case
4. **Configure table output format** based on downstream needs
5. **Implement robust error handling** with retries
6. **Monitor credit usage** for cost optimization
7. **Test in Studio first** before production deployment
8. **Use TypeScript** for type safety
9. **Cache results** when appropriate
10. **Implement webhooks** for async processing

---

**Document Status:** Indexed and ready for TypeScript backend integration
**Last Updated:** 2025-11-05
**Next Steps:**
- Obtain API key from https://studio.reducto.ai/
- Install `reductoai` npm package
- Test basic parse functionality
- Implement error handling and retry logic
- Set up async processing if needed
