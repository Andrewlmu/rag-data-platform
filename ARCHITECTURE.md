# Agentic RAG System Architecture

## Overview
A production-grade RAG system using GPT-5 with ReAct agent pattern, supporting both structured data (CSV/Excel) and unstructured documents (PDF/TXT).

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Next.js)                              │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ QueryInterface  │  │  FileUpload  │  │  DataStats/Results      │   │
│  │  - Text input   │  │  - Multi-file│  │  - Display answers      │   │
│  │  - 5min timeout │  │  - Drag&drop │  │  - Show sources         │   │
│  └────────┬────────┘  └──────┬───────┘  └──────────┬──────────────┘   │
│           │                   │                      │                   │
│           └───────────────────┴──────────────────────┘                   │
│                               │                                          │
│                    ┌──────────▼──────────┐                              │
│                    │   Socket.io Client  │                              │
│                    │  (Real-time events) │                              │
│                    └──────────┬──────────┘                              │
└───────────────────────────────┼───────────────────────────────────────┘
                                │
                    HTTP/WebSocket (port 3000 → 8000)
                                │
┌───────────────────────────────▼───────────────────────────────────────┐
│                       BACKEND (Express + Socket.io)                    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    API ENDPOINTS                                 │  │
│  │  POST /api/query    → Execute agentic query                     │  │
│  │  POST /api/upload   → Process & index documents                 │  │
│  │  GET  /api/stats    → Get document statistics                   │  │
│  │  GET  /api/readiness → Check if system has indexed data         │  │
│  └────────────────────────┬────────────────────────────────────────┘  │
│                           │                                            │
│  ┌────────────────────────▼────────────────────────────────────────┐  │
│  │                    QUERY ENGINE                                  │  │
│  │  - Routes to Agentic RAG or Basic RAG                           │  │
│  │  - Coordinates services                                          │  │
│  └────────────────────────┬────────────────────────────────────────┘  │
│                           │                                            │
│  ┌────────────────────────▼────────────────────────────────────────┐  │
│  │                    AGENTIC RAG                                   │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │            ReAct Agent (LangGraph)                        │  │  │
│  │  │  ┌──────┐    ┌─────────┐    ┌───────┐    ┌────────┐     │  │  │
│  │  │  │ LLM  │───▶│Validate │───▶│ Tools │───▶│ Router │     │  │  │
│  │  │  │Node  │    │  Node   │    │ Node  │    │  Node  │     │  │  │
│  │  │  └──┬───┘    └────┬────┘    └───┬───┘    └───┬────┘     │  │  │
│  │  │     │             │              │            │           │  │  │
│  │  │     │             │              │            │           │  │  │
│  │  │     └─────────────┴──────────────┴────────────┘           │  │  │
│  │  │                   Loop until finish                       │  │  │
│  │  │                   (Max 50 iterations)                     │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  │                           │                                      │  │
│  │  ┌────────────────────────▼────────────────────────────────┐  │  │
│  │  │                 TOOL REGISTRY                            │  │  │
│  │  │  ┌────────────────┐  ┌─────────────────┐               │  │  │
│  │  │  │ vector_search  │  │ search_dataset  │               │  │  │
│  │  │  │                │  │   _metadata     │               │  │  │
│  │  │  └────────────────┘  └─────────────────┘               │  │  │
│  │  │  ┌────────────────┐  ┌─────────────────┐               │  │  │
│  │  │  │ query_         │  │ ask_            │               │  │  │
│  │  │  │ structured_data│  │ clarification   │               │  │  │
│  │  │  └────────────────┘  └─────────────────┘               │  │  │
│  │  │  ┌────────────────┐                                     │  │  │
│  │  │  │    finish      │                                     │  │  │
│  │  │  └────────────────┘                                     │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      CORE SERVICES                            │  │
│  │  ┌────────────────┐  ┌─────────────┐  ┌──────────────────┐  │  │
│  │  │ VectorSearch   │  │DataProcessor│  │ DocumentParser   │  │  │
│  │  │ - Chroma DB    │  │ - DuckDB    │  │ - PDF parser     │  │  │
│  │  │ - Embeddings   │  │ - SQL       │  │ - Excel parser   │  │  │
│  │  │ - Similarity   │  │ - Metadata  │  │ - CSV parser     │  │  │
│  │  └────────────────┘  └─────────────┘  └──────────────────┘  │  │
│  │  ┌────────────────┐  ┌─────────────┐                        │  │
│  │  │DocumentStore   │  │ ParentChild │                        │  │
│  │  │ - Parent docs  │  │  Retriever  │                        │  │
│  │  │ - Child chunks │  │ - Hierarchy │                        │  │
│  │  └────────────────┘  └─────────────┘                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
        ┌───────────▼────────┐  ┌──────────▼─────────┐
        │   Chroma VectorDB  │  │   DuckDB           │
        │   - Text chunks    │  │   - CSV/Excel data │
        │   - Embeddings     │  │   - SQL queries    │
        │   - Metadata       │  │   - Analytics      │
        └────────────────────┘  └────────────────────┘
```

---

## 🔄 ReAct Agent Flow (LangGraph)

```
START
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  LLM Node (GPT-5)                                            │
│  - Model: gpt-5                                              │
│  - Temperature: 1 (fixed, no control)                        │
│  - Max Tokens: 5000                                          │
│  - Timeout: 300 seconds (5 minutes)                          │
│  - Recursion Limit: 50 iterations                            │
│                                                               │
│  Decides: Which tool to call? Or finish?                     │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│  Validation Node                                             │
│  - Checks for text-based clarification patterns             │
│  - Detects: "How can I help?", "Which X?", etc.            │
│  - 3-strike system with escalating corrections               │
│                                                               │
│  Validates: Is response valid tool call or finish?          │
└─────┬──────────────┬──────────────────────┬─────────────────┘
      │              │                      │
  ❌ Failed     ✅ Tool Call          ✅ Finish
      │              │                      │
      ▼              ▼                      ▼
  Inject          Tools Node              END
  Correction         │                  (Return answer)
  Message            │
      │              ▼
      │    ┌──────────────────────┐
      │    │  Execute Tool        │
      │    │  - vector_search     │
      │    │  - search_dataset    │
      │    │  - query_structured  │
      │    │  - ask_clarification │
      │    │  - finish            │
      │    └──────────┬───────────┘
      │               │
      │               ▼
      │    ┌──────────────────────┐
      │    │  Router Node         │
      │    │  - Should continue?  │
      │    │  - Or end?           │
      │    └──────────┬───────────┘
      │               │
      └───────────────┴─► Loop back to LLM Node
                          (Unless finished or hit recursion limit)
```

---

## 🛠️ Tool Descriptions

### 1. **vector_search**
- **Purpose**: Search unstructured text documents (PDFs, TXT)
- **Backend**: Chroma vector database
- **Process**:
  1. Convert query to embedding
  2. Semantic similarity search
  3. Return top-k relevant chunks
  4. Optional: Parent-child hierarchical retrieval

### 2. **search_dataset_metadata**
- **Purpose**: Find structured datasets (CSV/Excel) by semantic search
- **Backend**: Chroma vector database (metadata embeddings)
- **Returns**:
  - Table names
  - Column schemas (names + types)
  - Row counts
  - Data ranges

### 3. **query_structured_data**
- **Purpose**: Execute SQL queries on structured datasets
- **Backend**: DuckDB
- **Process**:
  1. Agent generates SQL from schema
  2. Execute query on DuckDB
  3. Return result rows
  4. Agent formats as answer

### 4. **ask_clarification** (GPT-5 Powered)
- **Purpose**: Auto-resolve query ambiguities
- **Backend**: Separate GPT-5 call
- **Process**:
  1. Agent describes uncertainties
  2. Provides full context (query, schemas, data ranges)
  3. GPT-5 makes intelligent decisions
  4. Returns: {decision, parameters, reasoning, sqlHint}
- **Example**: "Which year?" → Auto-selects latest year
- **Example**: "Which countries?" → Auto-selects top 10

### 5. **finish**
- **Purpose**: Return final answer to user
- **Required**: Agent MUST call this when done
- **Format**: {answer: string, sources: [], confidence: number}

---

## 📊 Data Flow

### Query Processing Flow

```
User Question
     │
     ▼
Frontend (QueryInterface)
     │
     ▼
Backend (/api/query)
     │
     ▼
QueryEngine
     │
     ▼
AgenticRAG.query()
     │
     ▼
ReactAgent.query()
     │
     ├─► Loop 1: LLM → search_dataset_metadata
     │                 └─► VectorSearch → Chroma
     │                      └─► Returns: infantmortalityrate table schema
     │
     ├─► Loop 2: LLM → ask_clarification
     │                 └─► GPT-5 call
     │                      └─► Returns: {year: 2019, limit: 10, orderBy: DESC}
     │
     ├─► Loop 3: LLM → query_structured_data
     │                 └─► DuckDB
     │                      └─► Execute: SELECT Location, Rate FROM infantmortalityrate
     │                                    WHERE Period = 2019 ORDER BY Rate DESC LIMIT 10
     │                      └─► Returns: [Nigeria: 75.2, Chad: 72.1, ...]
     │
     └─► Loop 4: LLM → finish
                       └─► Returns: {answer: "Top 10 countries...", sources: [...]}
     │
     ▼
QueryEngine (format response)
     │
     ▼
Frontend (display answer + sources)
```

### Document Upload Flow

```
User Uploads File (PDF/CSV/Excel)
     │
     ▼
Frontend (FileUpload)
     │
     ▼
Backend (/api/upload)
     │
     ▼
DocumentParser
     │
     ├─► PDF → Text extraction + chunking
     ├─► CSV → Parse rows + metadata
     └─► Excel → Parse sheets + metadata
     │
     ▼
DataProcessor
     │
     ├─► Structured Data (CSV/Excel)
     │   └─► Store in DuckDB
     │   └─► Create metadata embedding → Chroma
     │
     └─► Unstructured Data (PDF/TXT)
         └─► Chunk text
         └─► Generate embeddings → Chroma
         └─► Optional: Parent-child hierarchy → DocumentStore
```

---

## 🧠 Validation System (Anti-Clarification Defense)

### Problem
At temperature=1 (GPT-5 fixed), the agent randomly decides to ask clarification questions instead of using tools.

### Solution: Multi-Layer Defense

```
Layer 1: System Prompt
├─ "NEVER respond with text clarifications"
├─ "Use ask_clarification tool instead"
└─ "Make reasonable assumptions or call ask_clarification"

Layer 2: ask_clarification Tool
├─ Provides GPT-5-powered smart defaults
├─ Auto-resolves uncertainties without user input
└─ Returns specific parameters for queries

Layer 3: Validation Node
├─ Runs after EVERY LLM response
├─ Pattern matching for clarification text:
│  - "How can I help?"
│  - "Which X would you like?"
│  - "You could ask..."
│  - etc. (10+ patterns)
├─ On detection:
│  ├─ Block response
│  ├─ Increment validationFailures counter
│  ├─ Inject correction message
│  └─ Force retry (back to LLM node)
└─ Escalating corrections (3 strikes):
   ├─ Strike 1: Gentle reminder
   ├─ Strike 2: Stronger warning
   └─ Strike 3: Mandatory execution with SQL hint
```

---

## 🔧 Key Configuration

```typescript
// Agent Config (agent.config.ts)
{
  maxLoops: 10,              // Soft limit (not enforced in LangGraph)
  timeout: 60000,            // 60 seconds (backend operation timeout)

  llm: {
    model: 'gpt-5',
    temperature: 1,          // Fixed, no control in GPT-5
    maxTokens: 5000,         // Increased from 2000 to prevent JSON truncation
  }
}

// LangGraph Config (react-agent.ts)
{
  recursionLimit: 50,        // Max graph iterations (attempted, may not work)
}

// Server Config (server.ts)
{
  timeout: 240000,           // 4 minutes (HTTP request timeout)
  keepAliveTimeout: 245000,  // 4m 5s (slightly longer than timeout)
}

// Frontend Config (QueryInterface.tsx)
{
  timeout: 300000,           // 5 minutes (axios request timeout)
}
```

---

## 🗄️ Data Storage

### Chroma Vector Database
```
Collection: "documents"
├─ Unstructured document chunks
│  ├─ Text content
│  ├─ Embeddings (768-dim)
│  └─ Metadata: {filename, page, chunkIndex, ...}
│
└─ Structured dataset metadata
   ├─ Table description (embedded)
   ├─ Column schemas
   └─ Metadata: {tableName, rowCount, columns, ...}
```

### DuckDB (In-Memory SQL)
```
Tables (dynamic, created per CSV/Excel)
├─ infantmortalityrate
│  ├─ Period (INTEGER)
│  ├─ Location (TEXT)
│  ├─ First Tooltip (TEXT)
│  └─ Dim1 (TEXT)
│
├─ maternalmortalityratio
│  └─ ... (schema varies per file)
│
└─ ... (one table per uploaded CSV/Excel)
```

### DocumentStore (Optional, Hierarchical Mode)
```
In-Memory Storage
├─ Parent documents (full pages/sections)
└─ Child chunks (smaller segments)
    └─ Linked to parent for context retrieval
```

---

## 🚀 Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| **Max Query Time** | 300s | 5-minute timeout (frontend) |
| **Max Agent Loops** | 50 | Recursion limit (may not be enforced) |
| **LLM Output Tokens** | 5000 | Prevents JSON truncation |
| **Server Timeout** | 240s | 4-minute HTTP timeout |
| **File Upload Limit** | 100MB | Per file |
| **Max Files per Upload** | 10 | Concurrent processing |

---

## 🔒 Error Recovery

### JSON Truncation (Fixed)
- **Issue**: maxTokens=2000 too low → finish response cut off → JSON parse error
- **Fix**: Increased to 5000 tokens
- **Impact**: Eliminates malformed finish responses

### Recursion Limit (In Progress)
- **Issue**: recursionLimit=50 not applied → still defaults to 25
- **Status**: Under investigation
- **Workaround**: TypeScript @ts-ignore used, may need different property name

### Validation False Positives
- **Issue**: Validation might catch legitimate completion messages
- **Mitigation**: 10 specific patterns, only blocks when NO tool_calls present
- **Monitoring**: Track validationFailures counter in logs

---

## 📝 System Prompt Strategy

### Core Directives (Priority Order)

1. **MANDATORY TOOL USAGE**
   - Never respond with text clarifications
   - Always use tools (ask_clarification or make assumptions)

2. **MANDATORY FINISH PROTOCOL**
   - Must call finish when answer is ready
   - Never skip finish step

3. **ANTI-LOOP PROTECTION**
   - Max 2 consecutive search_dataset_metadata calls
   - After finding data, MUST query it

4. **ADAPTATION STRATEGY**
   - Work with imperfect data
   - Show closest alternative if exact match unavailable
   - Never give up or ask for clarification

5. **SQL QUERY PATTERNS**
   - 6 patterns for common query types
   - Use exact column names from schema
   - Make reasonable assumptions for exploratory queries

---

## 🎯 Design Decisions

### Why GPT-5?
- Latest model with best reasoning
- Fixed temperature=1 (no choice, requires structural solutions)
- Longer context window for complex reasoning

### Why LangGraph?
- Explicit state management
- Easy to add validation nodes
- Clear routing logic
- Better than raw ReAct loop

### Why Validation Node?
- Temperature=1 causes non-determinism
- Can't fix with prompt alone
- Structural enforcement needed
- Catches bad behavior before returning to user

### Why ask_clarification Tool?
- Provides smart defaults without user interaction
- Uses GPT-5 for intelligent decision-making
- Faster than asking user (no roundtrip)
- More reliable than hardcoded rules

### Why Separate Vector/Structured Storage?
- Different access patterns
- SQL for exact numerical queries (DuckDB)
- Semantic search for text (Chroma)
- Best tool for each job

---

## 🐛 Known Issues

1. **Recursion Limit Not Applied**
   - Set to 50 but still defaults to 25
   - @ts-ignore approach didn't work
   - Need to research correct LangGraph configuration

2. **Validation Effectiveness Uncertain**
   - Infrastructure working but not yet triggered in tests
   - Unclear if deterrence effect or just lucky
   - Need more test runs for statistical validation

3. **Analysis Paralysis**
   - Agent sometimes loops on exploratory queries
   - Keeps refining queries without calling finish
   - Partially addressed by higher recursion limit (when working)

---

## 📚 Key Files

```
/src/
├── agents/
│   ├── agenticRAG.ts           # Main controller, initializes tools
│   ├── react-agent.ts          # LangGraph workflow, validation logic
│   └── tools/
│       ├── ask-clarification.ts # GPT-5 powered clarification resolver
│       ├── query-structured-data.ts
│       ├── search-dataset-metadata.ts
│       ├── vector-search-tool.ts
│       └── finish-tool.ts
│
├── config/
│   └── agent.config.ts         # System prompt, LLM config
│
├── services/
│   ├── vectorSearch.ts         # Chroma integration
│   ├── dataProcessor.ts        # DuckDB + document processing
│   ├── parentChildRetriever.ts # Hierarchical retrieval
│   ├── documentParser.ts       # PDF/CSV/Excel parsing
│   └── queryEngine.ts          # Query routing
│
└── backend/
    └── server.ts               # Express API, Socket.io

/frontend/
└── components/
    ├── QueryInterface.tsx      # Main query UI
    ├── FileUpload.tsx          # Document upload
    └── ResultsDisplay.tsx      # Answer display
```

---

## 🔮 Future Enhancements

1. **Streaming Responses**
   - Show tool calls in real-time
   - Stream LLM reasoning steps
   - Better UX for long queries

2. **Query Plan Visualization**
   - Show agent's reasoning graph
   - Display tool call sequence
   - Debug validation failures

3. **Adaptive Recursion Limit**
   - Adjust based on query complexity
   - Early termination for simple queries
   - Auto-extension for complex analysis

4. **Multi-Model Support**
   - Fallback to GPT-4 for simple queries (cheaper)
   - Use GPT-5 only for complex reasoning
   - Cost optimization

5. **Caching Layer**
   - Cache common queries
   - Cache dataset metadata
   - Reduce redundant LLM calls

---

## 💡 Pro Tips for Your Cofounder

1. **The temperature=1 problem is the core challenge**
   - Can't reduce randomness with GPT-5
   - Requires structural solutions (validation, tools)
   - Prompt engineering alone insufficient

2. **Validation is defense-in-depth**
   - System prompt (Layer 1)
   - Smart defaults tool (Layer 2)
   - Validation node (Layer 3)
   - All three needed for reliability

3. **LangGraph enables structural solutions**
   - Validation node wouldn't be possible with basic ReAct
   - State management crucial for tracking failures
   - Conditional routing enables retry logic

4. **DuckDB + Chroma = Best of both worlds**
   - DuckDB for exact numerical queries (fast, accurate)
   - Chroma for semantic search (flexible, intelligent)
   - Don't force one tool for all jobs

5. **Current bottleneck: Recursion limit bug**
   - Once fixed, system should handle complex queries
   - JSON truncation fix will eliminate finish errors
   - 5-minute timeout gives plenty of headroom
