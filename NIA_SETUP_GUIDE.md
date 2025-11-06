# NIA (trynia.ai) Setup Guide for Documentation Indexing

## Overview

NIA is an AI-powered documentation indexing and retrieval system that can be used to analyze and query technical documentation. This guide explains how to set up and use NIA with your PE Analysis platform.

---

## What is NIA?

NIA (Neural Information Assistant) is a tool that:
- Indexes documentation from URLs or local files
- Creates semantic embeddings for fast retrieval
- Provides context-aware answers from documentation
- Integrates with Claude Code via MCP (Model Context Protocol)

---

## Prerequisites

1. **NIA Account**: Sign up at https://trynia.ai
2. **API Key**: Obtain from NIA dashboard
3. **Claude Code**: Running on your machine
4. **MCP Configuration**: Access to Claude Code config

---

## Installation Steps

### Step 1: Install NIA MCP Server

```bash
# Install via pipx (recommended)
pipx install nia-mcp-server

# Verify installation
nia-mcp-server --version
```

### Step 2: Configure MCP in Claude Code

**Location**: Create or update `~/.claude/config.json`

```json
{
  "mcpServers": {
    "nia": {
      "command": "nia-mcp-server",
      "env": {
        "NIA_API_KEY": "your-nia-api-key-here"
      }
    }
  }
}
```

### Step 3: Restart Claude Code

After updating the config, restart Claude Code to load the MCP server.

---

## Indexing Documentation

### Index OpenAI API Documentation

```bash
# Using NIA CLI
nia index \
  --name "openai-docs" \
  --url "https://platform.openai.com/docs" \
  --description "OpenAI API documentation for GPT-5, embeddings, and best practices"

# Specific sections
nia index \
  --name "openai-gpt5" \
  --url "https://platform.openai.com/docs/models/gpt-5" \
  --description "GPT-5 model documentation"

nia index \
  --name "openai-embeddings" \
  --url "https://platform.openai.com/docs/guides/embeddings" \
  --description "OpenAI embeddings guide"
```

### Index LangChain Documentation

```bash
nia index \
  --name "langchain-js" \
  --url "https://js.langchain.com/docs/get_started/introduction" \
  --description "LangChain JavaScript/TypeScript documentation"

nia index \
  --name "langchain-vectorstores" \
  --url "https://js.langchain.com/docs/modules/data_connection/vectorstores/" \
  --description "LangChain vector stores integration"
```

### Index ChromaDB Documentation

```bash
nia index \
  --name "chromadb" \
  --url "https://docs.trychroma.com/" \
  --description "ChromaDB vector database documentation"

nia index \
  --name "chromadb-js" \
  --url "https://docs.trychroma.com/js_reference/Collection" \
  --description "ChromaDB JavaScript client reference"
```

### Index Socket.io Documentation

```bash
nia index \
  --name "socketio" \
  --url "https://socket.io/docs/v4/" \
  --description "Socket.io v4 documentation for real-time communication"

nia index \
  --name "socketio-client" \
  --url "https://socket.io/docs/v4/client-api/" \
  --description "Socket.io client API reference"
```

### Index Express.js Documentation

```bash
nia index \
  --name "express" \
  --url "https://expressjs.com/en/guide/routing.html" \
  --description "Express.js routing and middleware guide"

nia index \
  --name "express-best-practices" \
  --url "https://expressjs.com/en/advanced/best-practice-performance.html" \
  --description "Express.js performance best practices"
```

---

## Querying Documentation via Claude Code

Once indexed, you can query documentation directly in Claude Code:

### Example Queries

**GPT-5 Configuration:**
```
@nia What are the optimal temperature and max_tokens settings for GPT-5 when doing financial analysis?
```

**Embeddings:**
```
@nia How do I batch embed multiple documents efficiently with OpenAI's text-embedding-3-large model?
```

**LangChain:**
```
@nia Show me the best way to implement retry logic with exponential backoff in LangChain JS
```

**ChromaDB:**
```
@nia What are the recommended HNSW parameters for ChromaDB when indexing financial documents?
```

**Socket.io:**
```
@nia How do I implement room-based broadcasting in Socket.io v4 for user-specific events?
```

**Express.js:**
```
@nia What are the security best practices for Express.js in production?
```

---

## Programmatic Usage (Alternative to MCP)

If MCP is not available, you can use NIA's REST API:

### Python Example

```python
import requests

NIA_API_KEY = "your-api-key"
headers = {"Authorization": f"Bearer {NIA_API_KEY}"}

# Query documentation
response = requests.post(
    "https://api.trynia.ai/v1/query",
    headers=headers,
    json={
        "query": "What are GPT-5 best practices for async processing?",
        "collections": ["openai-docs", "openai-gpt5"],
        "max_results": 5
    }
)

results = response.json()
for result in results["results"]:
    print(f"Source: {result['source']}")
    print(f"Content: {result['content']}")
    print(f"Relevance: {result['score']}")
    print("---")
```

### Node.js/TypeScript Example

```typescript
import axios from 'axios';

const NIA_API_KEY = process.env.NIA_API_KEY;

async function queryDocumentation(query: string, collections: string[]) {
  const response = await axios.post(
    'https://api.trynia.ai/v1/query',
    {
      query,
      collections,
      max_results: 5
    },
    {
      headers: {
        'Authorization': `Bearer ${NIA_API_KEY}`
      }
    }
  );

  return response.data.results;
}

// Usage
const results = await queryDocumentation(
  'How to implement streaming responses with GPT-5?',
  ['openai-docs', 'openai-gpt5']
);

results.forEach(result => {
  console.log('Source:', result.source);
  console.log('Content:', result.content);
  console.log('Relevance:', result.score);
  console.log('---');
});
```

---

## Integration with Your PE Analysis Platform

### Create a Documentation Query Service

**File**: `/Users/andymu/Desktop/poc/src/services/documentationService.ts`

```typescript
import axios from 'axios';

export interface DocResult {
  source: string;
  content: string;
  score: number;
  url?: string;
}

export class DocumentationService {
  private apiKey: string;
  private baseUrl = 'https://api.trynia.ai/v1';

  constructor() {
    this.apiKey = process.env.NIA_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  NIA_API_KEY not set, documentation queries disabled');
    }
  }

  async queryDocs(
    query: string,
    collections: string[] = ['openai-docs', 'langchain-js', 'chromadb']
  ): Promise<DocResult[]> {
    if (!this.apiKey) {
      throw new Error('NIA API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/query`,
        {
          query,
          collections,
          max_results: 5
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.results;
    } catch (error) {
      console.error('Documentation query failed:', error);
      throw error;
    }
  }

  async searchBestPractices(topic: string): Promise<DocResult[]> {
    const query = `What are the best practices for ${topic}?`;
    return this.queryDocs(query, [
      'openai-docs',
      'langchain-js',
      'express-best-practices',
      'socketio'
    ]);
  }

  async getCodeExamples(feature: string): Promise<DocResult[]> {
    const query = `Show code examples for implementing ${feature}`;
    return this.queryDocs(query);
  }
}
```

### Add Documentation Endpoint

**Update**: `/Users/andymu/Desktop/poc/src/backend/server.ts`

```typescript
import { DocumentationService } from '../services/documentationService';

const docService = new DocumentationService();

// Documentation query endpoint
app.post('/api/docs/query', async (req: Request, res: Response) => {
  try {
    const { query, collections } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await docService.queryDocs(query, collections);
    res.json({ results });
  } catch (error) {
    console.error('Documentation query error:', error);
    res.status(500).json({ error: 'Documentation query failed' });
  }
});

// Best practices endpoint
app.get('/api/docs/best-practices/:topic', async (req: Request, res: Response) => {
  try {
    const { topic } = req.params;
    const results = await docService.searchBestPractices(topic);
    res.json({ results });
  } catch (error) {
    console.error('Best practices query error:', error);
    res.status(500).json({ error: 'Failed to fetch best practices' });
  }
});
```

---

## CLI Scripts for Bulk Indexing

**Create**: `/Users/andymu/Desktop/poc/scripts/index-all-docs.sh`

```bash
#!/bin/bash

echo "🚀 Indexing all documentation for PE Analysis Platform..."

# OpenAI Documentation
echo "📚 Indexing OpenAI docs..."
nia index --name "openai-gpt5" \
  --url "https://platform.openai.com/docs/models/gpt-5" \
  --description "GPT-5 model documentation and API reference"

nia index --name "openai-embeddings" \
  --url "https://platform.openai.com/docs/guides/embeddings" \
  --description "OpenAI embeddings guide and best practices"

nia index --name "openai-api" \
  --url "https://platform.openai.com/docs/api-reference" \
  --description "OpenAI API reference documentation"

# LangChain Documentation
echo "🦜 Indexing LangChain docs..."
nia index --name "langchain-js-intro" \
  --url "https://js.langchain.com/docs/get_started/introduction" \
  --description "LangChain JavaScript introduction and setup"

nia index --name "langchain-chains" \
  --url "https://js.langchain.com/docs/modules/chains/" \
  --description "LangChain chains for complex workflows"

nia index --name "langchain-vectorstores" \
  --url "https://js.langchain.com/docs/modules/data_connection/vectorstores/" \
  --description "LangChain vector store integrations"

# ChromaDB Documentation
echo "🔍 Indexing ChromaDB docs..."
nia index --name "chromadb-getting-started" \
  --url "https://docs.trychroma.com/getting-started" \
  --description "ChromaDB getting started guide"

nia index --name "chromadb-js-client" \
  --url "https://docs.trychroma.com/js_reference/Client" \
  --description "ChromaDB JavaScript client documentation"

# Socket.io Documentation
echo "🔌 Indexing Socket.io docs..."
nia index --name "socketio-server" \
  --url "https://socket.io/docs/v4/server-api/" \
  --description "Socket.io v4 server API documentation"

nia index --name "socketio-client" \
  --url "https://socket.io/docs/v4/client-api/" \
  --description "Socket.io v4 client API documentation"

# Express.js Documentation
echo "⚡ Indexing Express.js docs..."
nia index --name "express-routing" \
  --url "https://expressjs.com/en/guide/routing.html" \
  --description "Express.js routing guide"

nia index --name "express-middleware" \
  --url "https://expressjs.com/en/guide/using-middleware.html" \
  --description "Express.js middleware guide"

nia index --name "express-security" \
  --url "https://expressjs.com/en/advanced/best-practice-security.html" \
  --description "Express.js security best practices"

nia index --name "express-performance" \
  --url "https://expressjs.com/en/advanced/best-practice-performance.html" \
  --description "Express.js performance best practices"

echo "✅ Documentation indexing complete!"
echo ""
echo "You can now query documentation using:"
echo "  nia query \"your question here\""
echo ""
echo "Or in Claude Code with:"
echo "  @nia your question here"
```

**Make executable:**
```bash
chmod +x /Users/andymu/Desktop/poc/scripts/index-all-docs.sh
```

**Run:**
```bash
cd /Users/andymu/Desktop/poc
./scripts/index-all-docs.sh
```

---

## Verification

### Test NIA Integration

```bash
# List indexed collections
nia list

# Query a specific topic
nia query "What are GPT-5 streaming best practices?"

# Search across all collections
nia query "async/await error handling patterns" --all
```

### Expected Output

```
Results for: "What are GPT-5 streaming best practices?"

[1] Source: openai-gpt5 (relevance: 0.92)
    When using GPT-5 with streaming enabled, always handle tokens
    asynchronously and implement proper error handling for
    disconnections...
    URL: https://platform.openai.com/docs/models/gpt-5

[2] Source: openai-api (relevance: 0.87)
    The streaming API returns server-sent events. Best practices
    include buffering tokens, handling backpressure, and...
    URL: https://platform.openai.com/docs/api-reference/streaming
```

---

## Troubleshooting

### MCP Server Not Found

**Issue**: Claude Code can't find NIA MCP server

**Solution**:
```bash
# Verify installation
which nia-mcp-server

# Check PATH
echo $PATH

# Reinstall if needed
pipx uninstall nia-mcp-server
pipx install nia-mcp-server
```

### API Key Issues

**Issue**: Authentication errors

**Solution**:
```bash
# Verify API key
echo $NIA_API_KEY

# Test directly
curl -H "Authorization: Bearer $NIA_API_KEY" \
  https://api.trynia.ai/v1/collections
```

### Indexing Failures

**Issue**: Documentation fails to index

**Solution**:
```bash
# Check if URL is accessible
curl -I https://platform.openai.com/docs

# Try with verbose mode
nia index --name "test" --url "https://example.com/docs" --verbose

# Check rate limits
nia status
```

---

## Best Practices

1. **Index Organization**: Create separate collections for each library
2. **Regular Updates**: Re-index documentation monthly to stay current
3. **Specific Queries**: Be specific in your questions for better results
4. **Collection Filtering**: Specify collections when you know the context
5. **Caching**: Cache frequently asked documentation queries

---

## Alternative: Manual Documentation Review

If NIA is not available, you can still validate your implementation by:

1. **Reading Official Docs**: Visit each library's official documentation
2. **Code Examples**: Look for example repositories on GitHub
3. **Community Resources**: Check Stack Overflow, Reddit discussions
4. **Changelog Review**: Read release notes for latest updates

### Key Documentation URLs

- **OpenAI**: https://platform.openai.com/docs
- **LangChain JS**: https://js.langchain.com/docs
- **ChromaDB**: https://docs.trychroma.com
- **Socket.io**: https://socket.io/docs/v4
- **Express.js**: https://expressjs.com/en/guide

---

## Summary

NIA provides a powerful way to:
- ✅ Index official documentation once
- ✅ Query multiple sources simultaneously
- ✅ Get context-aware answers with citations
- ✅ Stay updated with latest best practices
- ✅ Validate implementation decisions

For your PE Analysis platform, this ensures you're following the most recent best practices from official documentation sources.

---

**Next Steps:**

1. Set up NIA account and get API key
2. Run the bulk indexing script
3. Test queries via CLI
4. Integrate with Claude Code via MCP (optional)
5. Use documentation insights to improve your codebase

For detailed implementation recommendations based on documentation analysis, see:
- `DOCUMENTATION_ANALYSIS.md` - Comprehensive best practices review
- `IMPLEMENTATION_GUIDE.md` - Step-by-step implementation instructions
