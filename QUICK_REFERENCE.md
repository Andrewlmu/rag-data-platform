# Quick Reference: Critical Improvements

This is your go-to reference for the most impactful changes to implement.

---

## 🚨 Critical Issues (Fix Immediately)

### 1. GPT-5 Token Limit Too Low
**Current**: `maxTokens: 2000`
**Should be**: `maxTokens: 4096`

**Impact**: Complex financial analyses are being truncated
**Fix Time**: 2 minutes

```typescript
// src/services/queryEngine.ts - Line 23
this.llm = new ChatOpenAI({
  modelName: 'gpt-5',
  temperature: 0,
  maxTokens: 4096,  // CHANGE THIS
  // ... rest
});
```

### 2. No Request Validation
**Current**: Accepting any input
**Should have**: Input validation with Zod

**Impact**: Vulnerable to malformed requests
**Fix Time**: 30 minutes

```typescript
// Add to server.ts
import { z } from 'zod';

const QuerySchema = z.object({
  query: z.string().min(1).max(5000),
  filters: z.record(z.any()).optional()
});

// In endpoint:
const validated = QuerySchema.parse(req.body);
```

### 3. No Timeout Protection
**Current**: Requests can hang indefinitely
**Should have**: 60-90 second timeouts

**Impact**: Resources locked, poor UX
**Fix Time**: 20 minutes

```typescript
this.llm = new ChatOpenAI({
  // ... existing config
  timeout: 90000,  // ADD THIS
  maxRetries: 3    // ADD THIS
});
```

---

## ⚡ High-Impact Optimizations

### 1. Batch Embeddings (10x faster)
**Current**: Generating embeddings one at a time
**Should be**: Batching 100 at a time

**Impact**: 10x faster document processing
**Fix Time**: 1 hour

```typescript
// src/services/vectorSearch.ts
const batchSize = 100;
for (let i = 0; i < chunks.length; i += batchSize) {
  const batch = chunks.slice(i, i + batchSize);
  const embeddings = await this.embeddings.embedDocuments(
    batch.map(c => c.text)
  );
  // Process batch
}
```

### 2. Embedding Cache (90% cost reduction)
**Current**: Re-generating same embeddings
**Should have**: Redis cache

**Impact**: 90% reduction in embedding API calls
**Fix Time**: 2 hours

```typescript
// Install: npm install ioredis

// Check cache first
const cached = await redis.get(`embed:${hash(text)}`);
if (cached) return JSON.parse(cached);

// Generate and cache
const embedding = await embeddings.embedQuery(text);
await redis.setex(`embed:${hash(text)}`, 86400, JSON.stringify(embedding));
```

### 3. Rate Limiting
**Current**: No protection against abuse
**Should have**: Rate limits per IP

**Impact**: Prevent abuse, control costs
**Fix Time**: 15 minutes

```typescript
// Install: npm install express-rate-limit

import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use('/api/', limiter);
```

---

## 🛡️ Security Essentials

### 1. Input Sanitization
```typescript
function sanitizeQuery(query: string): string {
  let cleaned = sanitizeHtml(query, {
    allowedTags: [],
    allowedAttributes: {}
  });
  return cleaned.slice(0, 5000).trim();
}
```

### 2. Environment Validation
```typescript
const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  PORT: z.string().default('8000'),
  NODE_ENV: z.enum(['development', 'production', 'test'])
});

const env = EnvSchema.parse(process.env);
```

### 3. Error Response Sanitization
```typescript
// NEVER expose stack traces in production
app.use((err, req, res, next) => {
  console.error(err); // Log internally
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});
```

---

## 📊 Monitoring Must-Haves

### 1. Basic Logging
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('Query executed', { query, time: processingTime });
logger.error('Query failed', { query, error: err.message });
```

### 2. Health Check Enhancement
```typescript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      vectorSearch: await checkVectorSearch(),
      openai: await checkOpenAI()
    }
  };

  const status = health.services.vectorSearch && health.services.openai
    ? 200
    : 503;

  res.status(status).json(health);
});
```

### 3. Metrics Endpoint
```typescript
import { Counter, Histogram } from 'prom-client';

const queryCounter = new Counter({
  name: 'queries_total',
  help: 'Total queries',
  labelNames: ['status']
});

const queryDuration = new Histogram({
  name: 'query_duration_seconds',
  help: 'Query duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

// Usage
const timer = queryDuration.startTimer();
try {
  const result = await executeQuery(query);
  queryCounter.inc({ status: 'success' });
  return result;
} finally {
  timer();
}
```

---

## 🔄 Async/Await Best Practices

### 1. Parallel Processing
```typescript
// ❌ BAD: Sequential
for (const file of files) {
  await processFile(file);
}

// ✅ GOOD: Parallel
await Promise.all(files.map(file => processFile(file)));
```

### 2. Retry with Exponential Backoff
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}
```

### 3. Graceful Degradation
```typescript
async function search(query: string): Promise<Results> {
  try {
    return await vectorSearch(query);
  } catch (error) {
    console.warn('Vector search failed, using fallback');
    return await textSearch(query); // Fallback
  }
}
```

---

## 🎯 ChromaDB Optimization

### 1. HNSW Configuration
```typescript
await client.createCollection({
  name: 'pe_analysis',
  metadata: {
    'hnsw:space': 'cosine',
    'hnsw:construction_ef': 100,
    'hnsw:search_ef': 50,
    'hnsw:M': 16
  }
});
```

### 2. Batch Operations
```typescript
// Process in batches of 100
const BATCH_SIZE = 100;
for (let i = 0; i < documents.length; i += BATCH_SIZE) {
  const batch = documents.slice(i, i + BATCH_SIZE);
  await collection.add({
    ids: batch.map(d => d.id),
    embeddings: await embedBatch(batch),
    documents: batch.map(d => d.content),
    metadatas: batch.map(d => d.metadata)
  });
}
```

### 3. Query Optimization
```typescript
// Retrieve 2x results for reranking
const results = await collection.query({
  queryEmbeddings: [embedding],
  nResults: k * 2
});

// Rerank and return top k
return rerank(results).slice(0, k);
```

---

## 🔌 Socket.io Best Practices

### 1. Reconnection Handling
```typescript
// Client-side
const socket = io(url, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000
});

socket.on('connect_error', (error) => {
  console.error('Connection failed:', error);
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconnected after ${attemptNumber} attempts`);
});
```

### 2. Room-based Broadcasting
```typescript
// Server-side
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
  });

  // Broadcast to specific user
  io.to(`user_${userId}`).emit('update', data);
});
```

### 3. Error Handling
```typescript
socket.on('error', (error) => {
  logger.error('Socket error', { error, socketId: socket.id });
  socket.emit('error', { message: 'An error occurred' });
});
```

---

## 📦 Production Deployment Checklist

### Before Deploy:
- [ ] Environment variables validated
- [ ] Secrets stored securely (not in .env)
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Error responses sanitized
- [ ] Logging configured
- [ ] Health checks working
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] Timeouts set on all operations

### After Deploy:
- [ ] Monitor error rates
- [ ] Check response times
- [ ] Verify health checks
- [ ] Test rate limiting
- [ ] Review logs
- [ ] Set up alerts
- [ ] Load test
- [ ] Document rollback procedure

---

## 💰 Cost Optimization

### 1. GPT-5 Costs
```
Input: $0.015 per 1K tokens
Output: $0.075 per 1K tokens

Example:
- 1000 queries/day
- Average 2K input + 1K output tokens
- Cost: (2 * $0.015 + 1 * $0.075) * 1000 = $105/day
```

**Optimization Tips:**
- Use temperature=0 for consistency
- Implement response caching
- Use streaming to show progress
- Set appropriate max_tokens

### 2. Embedding Costs
```
text-embedding-3-large: $0.00013 per 1K tokens

Example:
- 10,000 documents
- 500 tokens average
- Cost: 10,000 * 0.5 * $0.00013 = $0.65
```

**Optimization Tips:**
- Cache embeddings in Redis (90% savings)
- Batch operations (10x faster)
- Use 1536 dimensions if acceptable (50% savings)
- Deduplicate before embedding

### 3. Infrastructure Costs
```
Monthly estimates:
- EC2/VPS: $20-50
- Redis: $10-30
- ChromaDB: $0 (self-hosted) or $50-100 (managed)
- Monitoring: $0-20

Total: ~$50-200/month
```

---

## 🚀 Quick Wins Summary

| Improvement | Time | Impact | Priority |
|------------|------|--------|----------|
| Increase maxTokens | 2 min | High | CRITICAL |
| Add timeouts | 20 min | High | CRITICAL |
| Input validation | 30 min | High | CRITICAL |
| Rate limiting | 15 min | Medium | HIGH |
| Batch embeddings | 1 hour | Very High | HIGH |
| Add logging | 2 hours | Medium | HIGH |
| Embedding cache | 2 hours | Very High | MEDIUM |
| Error classes | 1 hour | Medium | MEDIUM |
| Health checks | 30 min | Medium | MEDIUM |
| Metrics | 3 hours | Medium | LOW |

**Total time for critical fixes: ~1 hour**
**Total time for high-priority items: ~5 hours**

---

## 📚 Essential Reading

### Must-Read Documentation:
1. [OpenAI GPT-5 Guide](https://platform.openai.com/docs/models/gpt-5)
2. [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
3. [LangChain JS Quickstart](https://js.langchain.com/docs/get_started/quickstart)
4. [ChromaDB Getting Started](https://docs.trychroma.com/getting-started)
5. [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

### Recommended Patterns:
- [Async/Await Best Practices](https://javascript.info/async-await)
- [Error Handling in Node.js](https://nodejs.org/api/errors.html)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

---

## 🆘 When Things Go Wrong

### High Error Rates
1. Check health endpoint: `curl http://localhost:8000/health`
2. Review logs: `tail -f logs/error.log`
3. Check OpenAI status: https://status.openai.com
4. Verify API key: `echo $OPENAI_API_KEY | wc -c`

### Slow Performance
1. Check metrics: `curl http://localhost:8000/metrics`
2. Review query times in logs
3. Check embedding cache hit rate
4. Monitor ChromaDB performance

### Memory Leaks
1. Monitor: `node --inspect server.js`
2. Check for unclosed connections
3. Review Promise chains for unhandled rejections
4. Use tools like `clinic.js` or `0x`

---

## 💡 Pro Tips

1. **Start small**: Implement critical fixes first
2. **Test locally**: Verify each change works before deploying
3. **Monitor everything**: You can't improve what you don't measure
4. **Iterate**: Don't try to implement everything at once
5. **Document changes**: Update this file as you make improvements

---

**Next Steps:**
1. Review DOCUMENTATION_ANALYSIS.md for detailed explanations
2. Follow IMPLEMENTATION_GUIDE.md for step-by-step instructions
3. Check NIA_SETUP_GUIDE.md for documentation indexing
4. Start with the critical fixes (1 hour work)
5. Move to high-priority items (4 more hours)
6. Monitor and iterate

**Good luck! You've got this!** 🎯
