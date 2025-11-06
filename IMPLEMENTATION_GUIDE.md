# Implementation Guide: Applying Best Practices

This guide provides step-by-step instructions to implement the recommendations from the Documentation Analysis.

---

## Phase 1: Quick Wins (1-2 Days)

### 1.1 Update GPT-5 Configuration

**File:** `/Users/andymu/Desktop/poc/src/services/queryEngine.ts`

**Current:**
```typescript
this.llm = new ChatOpenAI({
  modelName: 'gpt-5',
  temperature: 0,
  maxTokens: 2000,
  openAIApiKey: process.env.OPENAI_API_KEY,
  streaming: true
});
```

**Update to:**
```typescript
this.llm = new ChatOpenAI({
  modelName: 'gpt-5',
  temperature: 0,
  maxTokens: 4096,           // CHANGED: Increased for better responses
  timeout: 90000,            // NEW: 90 second timeout
  maxRetries: 3,             // NEW: Auto-retry
  openAIApiKey: process.env.OPENAI_API_KEY,
  streaming: true,
  topP: 0.95,               // NEW: More focused responses
  frequencyPenalty: 0.1,    // NEW: Reduce repetition
  presencePenalty: 0.1      // NEW: Topic diversity
});
```

### 1.2 Add Request Validation

**Install Zod (already in dependencies):**
```bash
# Zod is already installed, verify in package.json
```

**Create new file:** `/Users/andymu/Desktop/poc/src/validation/schemas.ts`

```typescript
import { z } from 'zod';

export const QueryRequestSchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .max(5000, 'Query too long (max 5000 characters)'),
  filters: z.record(z.any()).optional()
});

export const UploadRequestSchema = z.object({
  files: z.array(z.any()).min(1).max(10)
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;
export type UploadRequest = z.infer<typeof UploadRequestSchema>;
```

**Update:** `/Users/andymu/Desktop/poc/src/backend/server.ts`

```typescript
import { QueryRequestSchema } from '../validation/schemas';

// Update query endpoint
app.post('/api/query', async (req: Request, res: Response) => {
  try {
    // Validate request
    const validated = QueryRequestSchema.parse(req.body);

    io.emit('query:start', { query: validated.query });

    const result = await queryEngine.executeQuery(
      validated.query,
      validated.filters
    );

    io.emit('query:complete', { result });
    res.json(result);
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }

    console.error('Query error:', error);
    io.emit('query:error', { error: (error as Error).message });
    res.status(500).json({ error: 'Query execution failed' });
  }
});
```

### 1.3 Add Custom Error Classes

**Create new file:** `/Users/andymu/Desktop/poc/src/errors/index.ts`

```typescript
export class ApplicationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class QueryError extends ApplicationError {
  constructor(message: string, public query: string) {
    super(message, 400);
  }
}

export class VectorSearchError extends ApplicationError {
  constructor(message: string) {
    super(message, 503);
  }
}

export class DocumentParsingError extends ApplicationError {
  constructor(message: string, public filename: string) {
    super(message, 422);
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429);
  }
}

export class OpenAIAPIError extends ApplicationError {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message, 503);
  }
}
```

**Update error handling in server.ts:**

```typescript
import { ApplicationError } from '../errors';

// Replace existing error handler (around line 191)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log error with context
  console.error({
    timestamp: new Date().toISOString(),
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip
    }
  });

  // Handle application errors
  if (err instanceof ApplicationError) {
    return res.status(err.statusCode).json({
      error: err.message,
      type: err.name,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Handle unexpected errors
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      message: err.message,
      stack: err.stack
    })
  });
});
```

### 1.4 Environment Variable Validation

**Update:** `/Users/andymu/Desktop/poc/src/backend/server.ts`

Add at the top after imports:

```typescript
import { z } from 'zod';

// Environment validation schema
const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  PORT: z.string().default('8000'),
  FRONTEND_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

function validateEnv() {
  try {
    const env = EnvSchema.parse(process.env);
    console.log('✅ Environment variables validated');
    return env;
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

// Validate before initialization
const env = validateEnv();
```

---

## Phase 2: Performance Optimizations (3-5 Days)

### 2.1 Implement Retry Logic with Exponential Backoff

**Create new file:** `/Users/andymu/Desktop/poc/src/utils/retry.ts`

```typescript
export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: any) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true
  } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Don't retry if this is the last attempt or if shouldn't retry
      if (attempt === maxRetries - 1 || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );
      const jitter = Math.random() * 0.3 * exponentialDelay;
      const delay = exponentialDelay + jitter;

      console.log(
        `Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}
```

**Update:** `/Users/andymu/Desktop/poc/src/services/queryEngine.ts`

```typescript
import { retryWithBackoff, withTimeout } from '../utils/retry';
import { OpenAIAPIError } from '../errors';

export class QueryEngine {
  // ... existing code ...

  async executeQuery(
    query: string,
    filters?: Record<string, any>
  ): Promise<QueryResult> {
    return withTimeout(
      retryWithBackoff(
        () => this.executeQueryInternal(query, filters),
        {
          maxRetries: 3,
          baseDelay: 1000,
          shouldRetry: (error) => {
            // Retry on rate limits and transient errors
            return error.status === 429 || error.status >= 500;
          }
        }
      ),
      90000,
      'Query timeout after 90 seconds'
    );
  }

  private async executeQueryInternal(
    query: string,
    filters?: Record<string, any>
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // Existing query logic...
      const searchResults = await this.vectorSearch.search(query, 10, filters);
      const context = this.buildContext(searchResults);

      // ... rest of existing code
    } catch (error) {
      console.error('Query execution error:', error);
      throw new OpenAIAPIError(
        'Failed to execute query',
        error
      );
    }
  }
}
```

### 2.2 Add Embedding Caching with Redis

**Install Redis client:**
```bash
cd /Users/andymu/Desktop/poc
npm install ioredis
npm install --save-dev @types/ioredis
```

**Create new file:** `/Users/andymu/Desktop/poc/src/services/embeddingCache.ts`

```typescript
import Redis from 'ioredis';
import crypto from 'crypto';

export class EmbeddingCache {
  private redis: Redis;
  private ttl: number = 86400; // 24 hours

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true
    });

    this.redis.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      console.log('✅ Redis cache connected');
    } catch (error) {
      console.warn('⚠️  Redis unavailable, caching disabled');
    }
  }

  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  async get(text: string): Promise<number[] | null> {
    if (this.redis.status !== 'ready') return null;

    try {
      const key = `embed:${this.hashText(text)}`;
      const cached = await this.redis.get(key);

      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Cache get error:', error);
    }

    return null;
  }

  async set(text: string, embedding: number[]): Promise<void> {
    if (this.redis.status !== 'ready') return;

    try {
      const key = `embed:${this.hashText(text)}`;
      await this.redis.setex(
        key,
        this.ttl,
        JSON.stringify(embedding)
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
```

**Update:** `/Users/andymu/Desktop/poc/src/services/vectorSearch.ts`

```typescript
import { EmbeddingCache } from './embeddingCache';

export class VectorSearchService {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private embeddings: OpenAIEmbeddings;
  private embeddingCache: EmbeddingCache;
  private readonly collectionName = 'pe_analysis_data';

  constructor() {
    this.client = new ChromaClient();
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-large',
      openAIApiKey: process.env.OPENAI_API_KEY
    });
    this.embeddingCache = new EmbeddingCache();
  }

  async initialize(): Promise<void> {
    try {
      // Connect to cache
      await this.embeddingCache.connect();

      // Existing initialization...
      const collections = await this.client.listCollections();
      if (collections.some(c => c.name === this.collectionName)) {
        await this.client.deleteCollection({ name: this.collectionName });
      }

      this.collection = await this.client.createCollection({
        name: this.collectionName,
        metadata: {
          description: 'PE analysis data with GPT-5',
          'hnsw:space': 'cosine',
          'hnsw:construction_ef': 100,
          'hnsw:search_ef': 50,
          'hnsw:M': 16
        }
      });

      console.log('✅ Vector store initialized');
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  private async embedQueryWithCache(text: string): Promise<number[]> {
    // Try cache first
    const cached = await this.embeddingCache.get(text);
    if (cached) {
      console.log('📦 Cache hit for embedding');
      return cached;
    }

    // Generate embedding
    const embedding = await this.embeddings.embedQuery(text);

    // Cache for future use
    await this.embeddingCache.set(text, embedding);

    return embedding;
  }

  async search(
    query: string,
    k: number = 5,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    if (!this.collection) {
      throw new Error('Vector store not initialized');
    }

    try {
      // Use cached embedding
      const queryEmbedding = await this.embedQueryWithCache(query);

      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: k,
        where: filter
      });

      // Format results
      const searchResults: SearchResult[] = [];

      if (results.documents && results.documents[0]) {
        for (let i = 0; i < results.documents[0].length; i++) {
          searchResults.push({
            content: results.documents[0][i] || '',
            metadata: results.metadatas?.[0]?.[i] || {},
            score: results.distances?.[0]?.[i] || 0
          });
        }
      }

      return searchResults;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up vector store...');
    await this.embeddingCache.disconnect();
    this.collection = null;
  }
}
```

### 2.3 Batch Embedding Generation

**Update:** `/Users/andymu/Desktop/poc/src/services/vectorSearch.ts`

```typescript
async addDocument(doc: {
  id: string;
  content: string;
  metadata: Record<string, any>;
  chunks?: Array<{ text: string; metadata: Record<string, any> }>;
}): Promise<void> {
  if (!this.collection) {
    throw new Error('Vector store not initialized');
  }

  try {
    const chunks = doc.chunks || [{ text: doc.content, metadata: doc.metadata }];

    // IMPROVED: Batch embeddings in groups of 100
    const batchSize = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchTexts = batch.map(chunk => chunk.text);

      // Single API call for batch (much faster!)
      const embeddings = await this.embeddings.embedDocuments(batchTexts);
      allEmbeddings.push(...embeddings);

      console.log(`📊 Generated ${embeddings.length} embeddings (batch ${Math.floor(i/batchSize) + 1})`);
    }

    // Prepare data for ChromaDB
    const ids = chunks.map((_, index) => `${doc.id}_chunk_${index}`);
    const documents = chunks.map(chunk => chunk.text);
    const metadatas = chunks.map(chunk => ({
      ...chunk.metadata,
      documentId: doc.id,
      timestamp: new Date().toISOString()
    }));

    // Add to collection
    await this.collection.add({
      ids,
      embeddings: allEmbeddings,
      documents,
      metadatas
    });

    console.log(`✅ Added document ${doc.id} with ${chunks.length} chunks`);
  } catch (error) {
    console.error('Failed to add document:', error);
    throw error;
  }
}
```

### 2.4 Add Rate Limiting

**Install dependencies:**
```bash
cd /Users/andymu/Desktop/poc
npm install express-rate-limit
```

**Update:** `/Users/andymu/Desktop/poc/src/backend/server.ts`

```typescript
import rateLimit from 'express-rate-limit';

// Add after middleware setup, before routes

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for query endpoint
const queryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many queries, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to routes
app.use('/api/', apiLimiter);

// Update query endpoint with specific limiter
app.post('/api/query', queryLimiter, async (req: Request, res: Response) => {
  // ... existing query logic
});
```

---

## Phase 3: Advanced Features (1-2 Weeks)

### 3.1 Comprehensive Logging

**Install Winston:**
```bash
cd /Users/andymu/Desktop/poc
npm install winston
```

**Create new file:** `/Users/andymu/Desktop/poc/src/utils/logger.ts`

```typescript
import winston from 'winston';
import path from 'path';

const logDir = 'logs';

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'pe-analysis-api' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),

    // Combined logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760,
      maxFiles: 5
    }),

    // Query-specific logs
    new winston.transports.File({
      filename: path.join(logDir, 'queries.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Helper functions
export const logQuery = (data: {
  query: string;
  userId?: string;
  processingTime: number;
  resultsCount: number;
  confidence: number;
}) => {
  logger.info('Query executed', {
    type: 'query',
    ...data
  });
};

export const logError = (error: Error, context?: Record<string, any>) => {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    ...context
  });
};

export const logPerformance = (operation: string, duration: number, metadata?: Record<string, any>) => {
  logger.info(`Performance: ${operation}`, {
    type: 'performance',
    operation,
    duration,
    ...metadata
  });
};
```

**Update services to use logger:**

```typescript
// src/services/queryEngine.ts
import { logger, logQuery, logError, logPerformance } from '../utils/logger';

async executeQuery(query: string, filters?: Record<string, any>): Promise<QueryResult> {
  const startTime = Date.now();

  try {
    const result = await this.executeQueryInternal(query, filters);

    // Log query metrics
    logQuery({
      query,
      processingTime: result.processingTime,
      resultsCount: result.sources.length,
      confidence: result.confidence
    });

    return result;
  } catch (error) {
    logError(error as Error, { query, filters });
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    logPerformance('executeQuery', duration, { queryLength: query.length });
  }
}
```

### 3.2 Metrics with Prometheus

**Install Prometheus client:**
```bash
cd /Users/andymu/Desktop/poc
npm install prom-client
```

**Create new file:** `/Users/andymu/Desktop/poc/src/utils/metrics.ts`

```typescript
import { Counter, Histogram, Gauge, register } from 'prom-client';

// Query metrics
export const queryCounter = new Counter({
  name: 'pe_queries_total',
  help: 'Total number of queries processed',
  labelNames: ['status', 'type']
});

export const queryDuration = new Histogram({
  name: 'pe_query_duration_seconds',
  help: 'Query processing duration in seconds',
  labelNames: ['type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

// Embedding metrics
export const embeddingCounter = new Counter({
  name: 'pe_embeddings_total',
  help: 'Total number of embeddings generated',
  labelNames: ['cached']
});

export const embeddingDuration = new Histogram({
  name: 'pe_embedding_duration_seconds',
  help: 'Embedding generation duration',
  buckets: [0.1, 0.3, 0.5, 1, 2, 5]
});

// Document metrics
export const documentCounter = new Counter({
  name: 'pe_documents_processed_total',
  help: 'Total documents processed',
  labelNames: ['type', 'status']
});

// Connection metrics
export const activeConnections = new Gauge({
  name: 'pe_active_websocket_connections',
  help: 'Number of active WebSocket connections'
});

// Vector store metrics
export const vectorStoreSize = new Gauge({
  name: 'pe_vector_store_documents',
  help: 'Number of documents in vector store'
});

// API error metrics
export const apiErrors = new Counter({
  name: 'pe_api_errors_total',
  help: 'Total API errors',
  labelNames: ['endpoint', 'error_type']
});

// Export registry for scraping
export { register };
```

**Add metrics endpoint to server:**

```typescript
// src/backend/server.ts
import { register as metricsRegister } from '../utils/metrics';
import { activeConnections, queryCounter, queryDuration } from '../utils/metrics';

// Metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// Update query endpoint with metrics
app.post('/api/query', queryLimiter, async (req: Request, res: Response) => {
  const timer = queryDuration.startTimer({ type: 'standard' });

  try {
    const validated = QueryRequestSchema.parse(req.body);
    const result = await queryEngine.executeQuery(validated.query, validated.filters);

    queryCounter.inc({ status: 'success', type: 'standard' });
    res.json(result);
  } catch (error) {
    queryCounter.inc({ status: 'error', type: 'standard' });
    // ... error handling
  } finally {
    timer();
  }
});

// Track WebSocket connections
io.on('connection', (socket) => {
  activeConnections.inc();

  socket.on('disconnect', () => {
    activeConnections.dec();
  });
});
```

### 3.3 Health Check Enhancement

**Update health check endpoint:**

```typescript
// src/backend/server.ts

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    vectorSearch: boolean;
    dataProcessor: boolean;
    redis?: boolean;
  };
  model: string;
  async: boolean;
}

app.get('/health', async (req: Request, res: Response) => {
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      vectorSearch: !!vectorSearch,
      dataProcessor: !!dataProcessor
    },
    model: 'gpt-5',
    async: true
  };

  try {
    // Check vector search health
    if (vectorSearch) {
      await vectorSearch.getStats();
      healthStatus.services.vectorSearch = true;
    }

    // Add detailed health check if requested
    if (req.query.detailed === 'true') {
      const stats = await dataProcessor?.getDataStats();
      (healthStatus as any).stats = stats;
    }

    res.status(200).json(healthStatus);
  } catch (error) {
    healthStatus.status = 'degraded';
    healthStatus.services.vectorSearch = false;
    res.status(503).json(healthStatus);
  }
});

// Readiness probe (for k8s)
app.get('/ready', (req: Request, res: Response) => {
  if (vectorSearch && dataProcessor) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false });
  }
});

// Liveness probe
app.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});
```

---

## Phase 4: Testing Setup

### 4.1 Unit Test Configuration

**Install testing dependencies:**
```bash
cd /Users/andymu/Desktop/poc
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
```

**Create:** `/Users/andymu/Desktop/poc/jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

**Create sample test:** `/Users/andymu/Desktop/poc/tests/services/queryEngine.test.ts`

```typescript
import { QueryEngine } from '../../src/services/queryEngine';
import { VectorSearchService } from '../../src/services/vectorSearch';

// Mock vector search
jest.mock('../../src/services/vectorSearch');

describe('QueryEngine', () => {
  let queryEngine: QueryEngine;
  let mockVectorSearch: jest.Mocked<VectorSearchService>;

  beforeEach(() => {
    mockVectorSearch = {
      search: jest.fn()
    } as any;

    queryEngine = new QueryEngine(mockVectorSearch);
  });

  describe('executeQuery', () => {
    it('should return results with confidence score', async () => {
      // Mock search results
      mockVectorSearch.search.mockResolvedValue([
        {
          content: 'Sample content',
          metadata: { source: 'test.pdf' },
          score: 0.85
        }
      ]);

      const result = await queryEngine.executeQuery('test query');

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('sources');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('processingTime');
      expect(result.sources).toHaveLength(1);
    });

    it('should handle empty search results', async () => {
      mockVectorSearch.search.mockResolvedValue([]);

      const result = await queryEngine.executeQuery('test query');

      expect(result.confidence).toBe(0);
      expect(result.sources).toHaveLength(0);
    });

    it('should retry on transient failures', async () => {
      mockVectorSearch.search
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce([
          { content: 'Content', metadata: {}, score: 0.9 }
        ]);

      const result = await queryEngine.executeQuery('test query');

      expect(result).toBeDefined();
      expect(mockVectorSearch.search).toHaveBeenCalledTimes(2);
    });
  });
});
```

**Update package.json scripts:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## Deployment Steps

### Update .env file

Create: `/Users/andymu/Desktop/poc/.env`

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-key-here

# Server Configuration
PORT=8000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.com

# Redis Configuration (optional, for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Docker Configuration (Optional)

**Create:** `/Users/andymu/Desktop/poc/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["npm", "start"]
```

---

## Rollout Plan

### Week 1: Quick Wins
- [ ] Day 1: Update GPT-5 config, add validation
- [ ] Day 2: Implement error classes, env validation

### Week 2: Performance
- [ ] Day 1-2: Add retry logic and timeouts
- [ ] Day 3-4: Implement caching layer
- [ ] Day 5: Add rate limiting

### Week 3: Monitoring
- [ ] Day 1-2: Set up logging
- [ ] Day 3-4: Add metrics
- [ ] Day 5: Create dashboards

### Week 4: Testing & Polish
- [ ] Day 1-3: Write unit tests
- [ ] Day 4: Integration tests
- [ ] Day 5: Load testing and optimization

---

## Verification Checklist

After implementation:

- [ ] All environment variables validated on startup
- [ ] API requests include validation
- [ ] Errors are properly typed and logged
- [ ] Retry logic works for transient failures
- [ ] Timeouts prevent hanging requests
- [ ] Rate limiting prevents abuse
- [ ] Caching reduces API calls
- [ ] Logging captures all important events
- [ ] Metrics endpoint returns data
- [ ] Health checks work correctly
- [ ] Tests pass with good coverage
- [ ] Documentation is updated

---

## Support Resources

- **OpenAI Docs**: https://platform.openai.com/docs
- **LangChain JS**: https://js.langchain.com/docs
- **ChromaDB**: https://docs.trychroma.com
- **Express Best Practices**: https://expressjs.com/en/advanced/best-practice-performance.html
- **Socket.io**: https://socket.io/docs/v4

For questions, refer to the DOCUMENTATION_ANALYSIS.md file for detailed explanations.
