// CRITICAL FIXES FOR TYPESCRIPT PE ANALYSIS PLATFORM
// Apply these fixes immediately to resolve issues found in review

// ============================================
// FIX 1: Update QueryEngine with proper configuration
// File: src/services/queryEngine.ts
// ============================================

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

// FIXED: Added timeout, retry, and proper token limits
export class QueryEngineFixed {
  private llm: ChatOpenAI;

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-5',  // Keep GPT-5 as per user's November 2025 context
      temperature: 0,
      maxTokens: 4096,     // ✅ FIXED: Increased from 2000
      timeout: 30000,      // ✅ FIXED: Added 30 second timeout
      maxRetries: 3,       // ✅ FIXED: Added retry logic
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: true,
      // ✅ FIXED: Added request options
      requestOptions: {
        headers: {
          'X-Client-Name': 'PE-Analysis-Platform',
        },
      },
    });
  }

  // ✅ FIXED: Added retry wrapper
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        if (i === maxRetries - 1) throw error;

        // Check if it's a rate limit error
        if (error?.status === 429) {
          const retryAfter = error?.headers?.['retry-after'] || delay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
        } else {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }
    throw new Error('Max retries exceeded');
  }
}

// ============================================
// FIX 2: Optimize VectorSearch with batch embeddings
// File: src/services/vectorSearch.ts
// ============================================

import { OpenAIEmbeddings } from '@langchain/openai';

export class VectorSearchServiceFixed {
  private embeddings: OpenAIEmbeddings;
  private embeddingCache = new Map<string, number[]>();  // ✅ FIXED: Added cache

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',  // ✅ FIXED: Use actual model
      openAIApiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,  // ✅ FIXED: Added timeout
      maxRetries: 3,   // ✅ FIXED: Added retries
      batchSize: 100,  // ✅ FIXED: Enable batching
    });
  }

  // ✅ FIXED: Batch embedding with caching
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache first
    for (let i = 0; i < texts.length; i++) {
      const cached = this.embeddingCache.get(texts[i]);
      if (cached) {
        results[i] = cached;
      } else {
        uncachedTexts.push(texts[i]);
        uncachedIndices.push(i);
      }
    }

    // Batch embed uncached texts
    if (uncachedTexts.length > 0) {
      const embeddings = await this.embeddings.embedDocuments(uncachedTexts);

      // Store in cache and results
      for (let i = 0; i < embeddings.length; i++) {
        const text = uncachedTexts[i];
        const embedding = embeddings[i];
        const resultIndex = uncachedIndices[i];

        this.embeddingCache.set(text, embedding);
        results[resultIndex] = embedding;
      }
    }

    return results;
  }
}

// ============================================
// FIX 3: Add Rate Limiting Middleware
// File: src/middleware/rateLimiter.ts
// ============================================

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

// ✅ FIXED: Create rate limiters for different endpoints
export const createRateLimiters = () => {
  // Redis client for distributed rate limiting
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  });

  // API rate limiter
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Use Redis for distributed apps
    store: process.env.NODE_ENV === 'production'
      ? new RedisStore({ client: redisClient })
      : undefined,
  });

  // Query endpoint limiter (more restrictive)
  const queryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10, // 10 queries per minute
    message: 'Query rate limit exceeded. Please wait before making another query.',
  });

  // Upload limiter
  const uploadLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 uploads per 5 minutes
    message: 'Upload rate limit exceeded.',
  });

  return { apiLimiter, queryLimiter, uploadLimiter };
};

// ============================================
// FIX 4: Add Input Validation
// File: src/middleware/validation.ts
// ============================================

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ✅ FIXED: Define validation schemas
const QuerySchema = z.object({
  query: z.string().min(1).max(1000).trim(),
  filters: z.record(z.any()).optional(),
});

const UploadSchema = z.object({
  files: z.array(z.any()).min(1).max(10),
});

// ✅ FIXED: Validation middleware
export const validateQuery = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = QuerySchema.parse(req.body);
    req.body = validated;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }
    next(error);
  }
};

// ============================================
// FIX 5: Add API Key Validation on Startup
// File: src/utils/validateApiKey.ts
// ============================================

import { OpenAI } from 'openai';

// ✅ FIXED: Validate API key actually works
export async function validateOpenAIKey(): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
    console.error('❌ Invalid OpenAI API key in .env file');
    return false;
  }

  try {
    const openai = new OpenAI({ apiKey });

    // Make a minimal API call to verify the key works
    await openai.models.list();

    console.log('✅ OpenAI API key validated successfully');
    return true;
  } catch (error: any) {
    if (error?.status === 401) {
      console.error('❌ OpenAI API key is invalid');
    } else if (error?.status === 429) {
      console.error('⚠️ OpenAI API rate limit reached');
    } else {
      console.error('❌ Failed to validate OpenAI API key:', error?.message);
    }
    return false;
  }
}

// ============================================
// FIX 6: ChromaDB Docker Setup Script
// File: scripts/start-chromadb.sh
// ============================================

const CHROMADB_SETUP = `#!/bin/bash
# Start ChromaDB using Docker

echo "🚀 Starting ChromaDB..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker first."
  exit 1
fi

# Stop existing ChromaDB container if running
docker stop chromadb 2>/dev/null
docker rm chromadb 2>/dev/null

# Start ChromaDB
docker run -d \\
  --name chromadb \\
  -p 8000:8000 \\
  -v ./chroma_data:/chroma/chroma \\
  -e ALLOW_RESET=TRUE \\
  -e IS_PERSISTENT=TRUE \\
  chromadb/chroma:latest

# Wait for ChromaDB to be ready
echo "⏳ Waiting for ChromaDB to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null; then
    echo "✅ ChromaDB is ready!"
    exit 0
  fi
  sleep 1
done

echo "❌ ChromaDB failed to start"
exit 1
`;

// ============================================
// FIX 7: Updated Server with All Fixes
// File: src/backend/server-fixed.ts
// ============================================

export const SERVER_FIXES = `
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';  // ✅ FIXED: Added security headers
import compression from 'compression';  // ✅ FIXED: Added compression
import { createRateLimiters } from '../middleware/rateLimiter';
import { validateQuery } from '../middleware/validation';
import { validateOpenAIKey } from '../utils/validateApiKey';

const app = express();

// ✅ FIXED: Security middleware
app.use(helmet());
app.use(compression());

// ✅ FIXED: Restricted CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ✅ FIXED: Reduced JSON limit
app.use(express.json({ limit: '10mb' }));  // Was 50mb

// ✅ FIXED: Apply rate limiting
const { apiLimiter, queryLimiter, uploadLimiter } = createRateLimiters();
app.use('/api/', apiLimiter);
app.use('/api/query', queryLimiter);
app.use('/api/upload', uploadLimiter);

// ✅ FIXED: Validate API key on startup
async function startServer() {
  // Validate OpenAI key first
  const isValidKey = await validateOpenAIKey();
  if (!isValidKey) {
    console.error('Cannot start server with invalid OpenAI API key');
    process.exit(1);
  }

  // Rest of server startup...
}

// ✅ FIXED: Add validation to query endpoint
app.post('/api/query', validateQuery, async (req, res) => {
  // Query logic here
});
`;