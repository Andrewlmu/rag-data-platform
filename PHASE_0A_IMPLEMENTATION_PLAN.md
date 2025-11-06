# 🎯 Phase 0A Implementation Plan: Reducto Integration

**Date**: November 6, 2025
**Phase**: 0A - Enhanced PDF Parsing
**Risk Level**: 🟢 LOW (No architecture changes)
**Estimated Time**: 2-3 days
**Status**: PENDING APPROVAL

---

## 📋 Overview

### Goal
Replace basic `pdf-parse` library with Reducto API for better PDF document extraction while maintaining **zero architecture changes**.

### Success Criteria
- ✅ Reducto API integrated with feature flag
- ✅ Better extraction quality (tables, multi-column, complex layouts)
- ✅ Instant rollback capability (via feature flag)
- ✅ All existing tests still pass
- ✅ Response time < 5 seconds per PDF
- ✅ Cost < $0.10 per document

---

## 🏗️ Architecture Design

### Current Architecture (No Changes)
```
Document Upload
    ↓
documentParser.ts
    ├─ PDF: pdf-parse library
    ├─ Excel: xlsx library
    └─ Word: mammoth library
    ↓
Text Splitting (RecursiveCharacterTextSplitter)
    ↓
Vector Embedding
    ↓
Vector Store
```

### What Changes (Internal to documentParser only)
```typescript
// BEFORE
async parsePDF(file: Buffer) {
  const data = await pdfParse(file);
  return data.text;
}

// AFTER (with feature flag)
async parsePDF(file: Buffer) {
  if (process.env.USE_REDUCTO === 'true') {
    return await this.reductoClient.parse(file);  // NEW
  } else {
    const data = await pdfParse(file);
    return data.text;  // OLD (fallback)
  }
}
```

**Key Point**: Only internal implementation changes. External API remains identical.

---

## 📁 File Structure

### New Files to Create
```
src/
  services/
    reducto-client.ts          ← NEW: Reducto API wrapper
    documentParser.ts          ← MODIFY: Add Reducto integration
  types/
    reducto.types.ts          ← NEW: TypeScript interfaces

tests/
  unit/
    reducto-client.test.ts    ← NEW: Unit tests
  integration/
    pdf-parsing.test.ts       ← NEW: Compare old vs new
```

### Modified Files
```
.env                          ← ADD: REDUCTO_API_KEY, USE_REDUCTO
.env.example                  ← ADD: Example Reducto config
package.json                  ← ADD: reductoai dependency
src/services/documentParser.ts ← ADD: Reducto integration logic
```

---

## 🔧 Implementation Details

### Step 1: Install Dependencies

**Action:**
```bash
npm install reductoai
```

**Verification:**
```bash
npm list reductoai  # Should show version
```

---

### Step 2: Create Reducto Types

**File**: `src/types/reducto.types.ts`

```typescript
/**
 * Reducto API Types
 * Based on official API documentation
 */

export interface ReductoConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface ReductoParseOptions {
  // Chunking mode for RAG
  chunking_mode?: 'page_sections' | 'section' | 'page' | 'block' | 'disabled';

  // Table output format
  table_output_format?: 'dynamic' | 'json' | 'markdown' | 'html' | 'csv';

  // OCR system
  ocr_system?: 'standard' | 'advanced';

  // Enable embeddings
  enable_embeddings?: boolean;

  // Page range (e.g., "1-5")
  page_range?: string;

  // Timeout in seconds
  timeout?: number;
}

export interface ReductoBlock {
  type: 'Header' | 'Text' | 'Table' | 'Figure' | 'Caption';
  content: string;
  confidence: 'high' | 'medium' | 'low';
  bbox?: {
    left: number;
    top: number;
    width: number;
    height: number;
    page: number;
  };
  ocr_confidence?: number;
}

export interface ReductoChunk {
  content: string;
  embedding?: number[];
  blocks: ReductoBlock[];
}

export interface ReductoParseResult {
  job_id: string;
  duration: number;
  usage: {
    num_pages: number;
    credits?: number;
  };
  result: {
    type: 'full' | 'url';
    chunks: ReductoChunk[];
  };
}

export interface ReductoError {
  detail: Array<{
    loc: string[];
    msg: string;
    type: string;
  }>;
}
```

**Why This Design:**
- ✅ Type-safe API calls
- ✅ IDE autocomplete support
- ✅ Matches official Reducto API spec
- ✅ Extensible for future options

---

### Step 3: Create ReductoClient Wrapper

**File**: `src/services/reducto-client.ts`

```typescript
import { Reducto } from 'reductoai';
import type {
  ReductoConfig,
  ReductoParseOptions,
  ReductoParseResult,
  ReductoError,
} from '../types/reducto.types';

/**
 * ReductoClient - Elegant wrapper around Reducto API
 *
 * Features:
 * - Type-safe API calls
 * - Automatic retry logic
 * - Error handling with fallback
 * - Performance logging
 * - Cost tracking
 */
export class ReductoClient {
  private client: Reducto;
  private config: ReductoConfig;
  private totalCreditsUsed: number = 0;
  private totalDocumentsParsed: number = 0;

  constructor(config: ReductoConfig) {
    this.config = config;
    this.client = new Reducto({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://platform.reducto.ai',
      timeout: config.timeout || 30000, // 30 seconds default
    });
  }

  /**
   * Parse a PDF document with Reducto
   *
   * @param file - Buffer or file path
   * @param options - Parse options
   * @returns Extracted text content
   */
  async parsePDF(
    file: Buffer | string,
    options: ReductoParseOptions = {}
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Default options optimized for PE document analysis
      const parseOptions: ReductoParseOptions = {
        chunking_mode: 'page_sections', // Best for RAG
        table_output_format: 'markdown',  // LLM-friendly
        ocr_system: 'standard',           // Most docs are clean PDFs
        enable_embeddings: false,         // We do embeddings separately
        timeout: 60,                      // 60 seconds for parsing
        ...options, // Allow override
      };

      console.log('🔵 Reducto: Parsing PDF...');

      // Upload and parse
      const result = await this.parseWithRetry(file, parseOptions);

      // Extract text from chunks
      const text = this.extractTextFromResult(result);

      // Track usage
      this.updateMetrics(result);

      const duration = Date.now() - startTime;
      console.log(`✅ Reducto: Parsed in ${duration}ms (${result.usage.num_pages} pages)`);

      return text;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Reducto: Failed after ${duration}ms`, error);
      throw new Error(`Reducto parsing failed: ${this.formatError(error)}`);
    }
  }

  /**
   * Parse with automatic retry logic
   */
  private async parseWithRetry(
    file: Buffer | string,
    options: ReductoParseOptions,
    attempt: number = 1
  ): Promise<ReductoParseResult> {
    const maxAttempts = this.config.retryAttempts || 3;

    try {
      const result = await this.client.parse({
        file: file,
        ...options,
      });

      return result as ReductoParseResult;

    } catch (error: any) {
      // Don't retry validation errors (422)
      if (error.status === 422) {
        throw error;
      }

      // Retry server errors (500, 503) with exponential backoff
      if (attempt < maxAttempts && (error.status === 500 || error.status === 503)) {
        const backoff = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.warn(`⚠️ Reducto: Attempt ${attempt} failed, retrying in ${backoff}ms...`);
        await this.sleep(backoff);
        return this.parseWithRetry(file, options, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Extract plain text from Reducto result
   */
  private extractTextFromResult(result: ReductoParseResult): string {
    const chunks = result.result.chunks;

    // Concatenate all chunk content
    const text = chunks
      .map(chunk => chunk.content.trim())
      .filter(content => content.length > 0)
      .join('\n\n');

    return text;
  }

  /**
   * Extract structured blocks (for future advanced features)
   */
  public extractBlocks(result: ReductoParseResult) {
    return result.result.chunks.flatMap(chunk => chunk.blocks);
  }

  /**
   * Track usage metrics
   */
  private updateMetrics(result: ReductoParseResult): void {
    this.totalDocumentsParsed++;
    if (result.usage.credits) {
      this.totalCreditsUsed += result.usage.credits;
    }
  }

  /**
   * Get usage statistics
   */
  public getStats() {
    return {
      documentsProcessed: this.totalDocumentsParsed,
      creditsUsed: this.totalCreditsUsed,
      averageCreditsPerDoc: this.totalDocumentsParsed > 0
        ? this.totalCreditsUsed / this.totalDocumentsParsed
        : 0,
    };
  }

  /**
   * Format error message
   */
  private formatError(error: any): string {
    if (error.response?.data?.detail) {
      const details = error.response.data.detail as ReductoError['detail'];
      return details.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
    }
    return error.message || 'Unknown error';
  }

  /**
   * Sleep helper for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

**Design Rationale:**
- ✅ **Elegant API**: Simple `parsePDF()` method
- ✅ **Error Handling**: Automatic retries with exponential backoff
- ✅ **Metrics**: Track usage and costs
- ✅ **Type Safety**: Full TypeScript types
- ✅ **Logging**: Clear progress indicators
- ✅ **Extensible**: Easy to add features (blocks, tables, etc.)

---

### Step 4: Integrate into DocumentParser

**File**: `src/services/documentParser.ts` (MODIFY)

```typescript
import { ReductoClient } from './reducto-client';
import type { ReductoConfig } from '../types/reducto.types';

export class DocumentParser {
  private reductoClient: ReductoClient | null = null;

  constructor() {
    // Initialize Reducto if enabled
    if (process.env.USE_REDUCTO === 'true') {
      if (!process.env.REDUCTO_API_KEY) {
        throw new Error('REDUCTO_API_KEY required when USE_REDUCTO=true');
      }

      this.reductoClient = new ReductoClient({
        apiKey: process.env.REDUCTO_API_KEY,
        retryAttempts: 3,
        timeout: 30000,
      });

      console.log('✅ Reducto client initialized');
    }
  }

  /**
   * Parse PDF document
   * Uses Reducto if enabled, falls back to pdf-parse
   */
  async parsePDF(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);

    // NEW: Use Reducto if available
    if (this.reductoClient) {
      try {
        console.log('📄 Using Reducto for PDF parsing...');
        const text = await this.reductoClient.parsePDF(buffer);
        console.log(`✅ Reducto parsed ${text.length} characters`);
        return text;
      } catch (error) {
        console.error('❌ Reducto failed, falling back to pdf-parse', error);
        // Fall through to pdf-parse fallback
      }
    }

    // EXISTING: pdf-parse fallback
    console.log('📄 Using pdf-parse for PDF parsing...');
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    console.log(`✅ pdf-parse parsed ${data.text.length} characters`);
    return data.text;
  }

  /**
   * Get Reducto usage statistics (if enabled)
   */
  getReductoStats() {
    return this.reductoClient?.getStats() || null;
  }

  // ... rest of DocumentParser class unchanged
}
```

**Key Design Decisions:**
- ✅ **Feature Flag First**: Check `USE_REDUCTO` at initialization
- ✅ **Graceful Fallback**: If Reducto fails, use pdf-parse
- ✅ **Clear Logging**: Easy to debug which parser is used
- ✅ **Zero Breaking Changes**: External API identical

---

### Step 5: Environment Configuration

**File**: `.env` (ADD)

```bash
# Reducto Configuration
USE_REDUCTO=false                    # Feature flag (set to 'true' to enable)
REDUCTO_API_KEY=your_api_key_here   # Get from https://studio.reducto.ai/
```

**File**: `.env.example` (ADD)

```bash
# Reducto Configuration (Optional - Enhanced PDF Parsing)
USE_REDUCTO=false
REDUCTO_API_KEY=your_reducto_api_key_from_studio
```

**File**: `tsconfig.json` (VERIFY no changes needed)

Already configured correctly for TypeScript strict mode.

---

## 🧪 Testing Strategy

### Test 1: Unit Tests

**File**: `tests/unit/reducto-client.test.ts`

```typescript
import { ReductoClient } from '../../src/services/reducto-client';

describe('ReductoClient', () => {
  let client: ReductoClient;

  beforeEach(() => {
    client = new ReductoClient({
      apiKey: process.env.REDUCTO_API_KEY || 'test_key',
    });
  });

  test('should initialize with config', () => {
    expect(client).toBeDefined();
    expect(client.getStats().documentsProcessed).toBe(0);
  });

  test('should track metrics', () => {
    const stats = client.getStats();
    expect(stats).toHaveProperty('documentsProcessed');
    expect(stats).toHaveProperty('creditsUsed');
  });

  // More tests...
});
```

### Test 2: Integration Tests

**File**: `tests/integration/pdf-parsing.test.ts`

```typescript
describe('PDF Parsing Comparison', () => {
  test('Reducto vs pdf-parse: Table extraction', async () => {
    const testPDF = './tests/fixtures/financial_statement.pdf';

    // Parse with pdf-parse
    process.env.USE_REDUCTO = 'false';
    const oldParser = new DocumentParser();
    const oldResult = await oldParser.parsePDF(testPDF);

    // Parse with Reducto
    process.env.USE_REDUCTO = 'true';
    const newParser = new DocumentParser();
    const newResult = await newParser.parsePDF(testPDF);

    // Reducto should extract more structured content (tables)
    expect(newResult.length).toBeGreaterThan(oldResult.length);
    expect(newResult).toContain('|'); // Markdown table markers
  });
});
```

### Test 3: Manual Testing Plan

**Day 1: Sample Documents**
1. Upload simple 1-page PDF → Verify both parsers work
2. Upload 10-page report → Compare extraction quality
3. Upload PDF with tables → Reducto should extract table structure
4. Upload multi-column PDF → Reducto should handle layout better

**Day 2: Real PE Documents**
5. Upload financial statement (Excel-like tables)
6. Upload risk assessment memo (multi-column)
7. Upload due diligence report (mixed content)
8. Compare answer quality for queries on these docs

**Day 3: Performance & Cost**
9. Measure response time (should be < 5 seconds)
10. Calculate cost per document (should be < $0.10)
11. Test fallback (disable Reducto mid-query)
12. Verify feature flag works (toggle USE_REDUCTO)

---

## 🔄 Rollback Plan

### Instant Rollback (< 1 minute)
```bash
# In .env
USE_REDUCTO=false  # Just change this line
```

**Result**: System immediately uses pdf-parse, no code changes needed

### Full Rollback (If needed)
```bash
git revert HEAD  # Undo the commit
npm uninstall reductoai  # Remove dependency
```

**Result**: Complete removal of Reducto integration

---

## 📊 Success Metrics

### Quality Metrics
- [ ] Table extraction: 90%+ accuracy
- [ ] Multi-column: Correct reading order
- [ ] Complex layouts: Better than pdf-parse
- [ ] Answer quality: Improved for document queries

### Performance Metrics
- [ ] Response time: < 5 seconds per PDF
- [ ] Failure rate: < 1% (with retry logic)
- [ ] Fallback success: 100% (pdf-parse always works)

### Cost Metrics
- [ ] Cost per doc: < $0.10
- [ ] Monthly cost: < $100 for typical usage
- [ ] Credits tracking: Accurate in logs

---

## 🚨 Risk Mitigation

### Risk 1: API Key Exposure
**Mitigation**:
- Environment variable only
- Never commit `.env`
- Document in `.env.example`

### Risk 2: Reducto API Downtime
**Mitigation**:
- Automatic fallback to pdf-parse
- Retry logic with exponential backoff
- Monitor fallback usage

### Risk 3: Unexpected Costs
**Mitigation**:
- Track credits in real-time
- Set up usage alerts
- Test with small docs first

### Risk 4: Breaking Existing Functionality
**Mitigation**:
- Feature flag (can disable instantly)
- Existing tests must pass
- Fallback ensures zero downtime

---

## 📋 Implementation Checklist

### Pre-Implementation
- [x] NIA documentation indexed
- [ ] Reducto API key obtained from https://studio.reducto.ai/
- [ ] Test API key with curl
- [ ] Approval to proceed

### Implementation
- [ ] Install `reductoai` package
- [ ] Create `reducto.types.ts`
- [ ] Create `reducto-client.ts`
- [ ] Modify `documentParser.ts`
- [ ] Update `.env` and `.env.example`
- [ ] Write unit tests
- [ ] Write integration tests

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual test with simple PDF
- [ ] Manual test with complex PDF (tables)
- [ ] Manual test with multi-page document
- [ ] Compare old vs new quality
- [ ] Verify feature flag works
- [ ] Test fallback mechanism

### Deployment
- [ ] All tests passing
- [ ] Code formatted with Prettier
- [ ] Code linted with ESLint
- [ ] Git commit with clear message
- [ ] Push to GitHub
- [ ] Verify production env vars set

---

## 💰 Cost Estimate

### Setup Costs
- **Time**: 2-3 days development
- **API Key**: Free (first tier)

### Operational Costs
**Assumption**: 100 documents/month, average 10 pages each

- **Reducto**: $0.01-0.05 per page × 10 pages × 100 docs = **$10-50/month**
- **Infrastructure**: No additional cost (same servers)

**Total**: $10-50/month

**Note**: Can monitor actual costs and adjust usage

---

## 🎯 Next Steps After Phase 0A

Once Phase 0A is complete and validated:

1. **Immediate**: Demo to cofounder (compare old vs new)
2. **Next Week**: Phase 0B (Spire.XLS MCP for Excel)
3. **Week 3**: Phase 1 (LangGraph foundation)

---

## ❓ Questions Before Proceeding

1. **API Key**: Do you have a Reducto API key, or should I help you sign up?
2. **Testing Docs**: Do you have sample PE documents to test with?
3. **Timeline**: Confirm 2-3 days is acceptable?
4. **Budget**: Confirm $10-50/month operational cost is OK?

---

## ✅ Approval Required

**This plan is ready for your approval.**

Please confirm:
- [ ] Architecture approach looks good
- [ ] Code structure is clean and elegant
- [ ] Testing strategy is sufficient
- [ ] Rollback plan provides safety
- [ ] Ready to proceed with implementation

**Once approved, I'll execute this plan step-by-step with clean, elegant code.** 🚀
