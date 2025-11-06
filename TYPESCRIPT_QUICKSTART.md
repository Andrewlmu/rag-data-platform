# TypeScript PE Analysis POC - Quick Start Guide

## Overview
Complete TypeScript rewrite of the PE Data Analysis platform with full async capabilities and GPT-5 integration.

## Key Features
- ✅ Full async/await architecture throughout
- ✅ Express.js backend with TypeScript
- ✅ Real-time updates via WebSocket (Socket.io)
- ✅ GPT-5 powered analysis
- ✅ ChromaDB vector search
- ✅ Handles PDFs, Excel, Word, CSV documents
- ✅ Parallel processing for maximum performance

## Prerequisites
1. Node.js 18+ installed
2. OpenAI API key with GPT-5 access

## Setup Instructions

### 1. Configure Environment
Edit the `.env` file and add your OpenAI API key:
```bash
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Test the Setup
```bash
npx tsx test-backend.ts
```

### 4. Start the Backend Server
```bash
npm run dev:backend
```

The server will start on http://localhost:8000

## API Endpoints

### Health Check
```
GET /health
```

### Upload Documents
```
POST /api/upload
Content-Type: multipart/form-data
Files: multiple files (PDF, Excel, Word, CSV, TXT)
```

### Query Data
```
POST /api/query
Content-Type: application/json
Body: { "query": "Your question here" }
```

### Load Sample Data
```
POST /api/load-sample-data
```
Generates and loads 11,500+ sample data points

### Get Statistics
```
GET /api/stats
```

## Architecture

### Services
- **VectorSearchService**: Manages ChromaDB for semantic search
- **QueryEngine**: Handles RAG queries with GPT-5
- **DocumentParser**: Async document parsing (PDF, Excel, Word)
- **DataProcessor**: Data pipeline and sample generation

### Key Technologies
- **TypeScript**: Type-safe async programming
- **Express.js**: High-performance web framework
- **LangChain JS**: AI orchestration
- **ChromaDB**: Vector database
- **GPT-5**: Latest AI model (November 2025)
- **Socket.io**: Real-time updates

## Testing with cURL

### Load Sample Data
```bash
curl -X POST http://localhost:8000/api/load-sample-data
```

### Query Example
```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the main risk factors?"}'
```

### Upload File
```bash
curl -X POST http://localhost:8000/api/upload \
  -F "files=@document.pdf"
```

## WebSocket Events
Connect to `ws://localhost:8000` to receive real-time updates:
- `upload:start`, `upload:progress`, `upload:complete`
- `query:start`, `query:complete`
- `sample-data:loading`, `sample-data:loaded`

## Next Steps

### Frontend (To be implemented)
- Next.js 14 with TypeScript
- Real-time data visualization
- Drag-and-drop file upload
- Interactive query interface

### Production Deployment
- Add authentication
- Configure Redis for queue management
- Deploy to Railway/Vercel
- Add monitoring and logging

## Troubleshooting

### Port Already in Use
```bash
lsof -i :8000
kill -9 [PID]
```

### TypeScript Errors
```bash
npx tsc --noEmit  # Check for type errors
```

### Clear Vector Database
```bash
rm -rf chroma_db/
```

## Why TypeScript?

As requested, this implementation leverages TypeScript's async capabilities:
- Native `async/await` for all I/O operations
- Parallel processing with `Promise.all()`
- Type safety for large-scale applications
- Better IDE support and autocomplete
- Easier refactoring and maintenance

## Performance

With full async implementation:
- Parallel document processing
- Non-blocking I/O operations
- Streaming responses for large queries
- WebSocket for real-time updates
- Optimized vector search with ChromaDB

---

**Note**: This is the TypeScript version as explicitly requested. The system uses GPT-5, the latest model as of November 2025.