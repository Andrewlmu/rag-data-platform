import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

// Load environment variables
dotenv.config();

// Import services (to be created)
import { DataProcessor } from '../services/dataProcessor';
import { VectorSearchService } from '../services/vectorSearch';
import { QueryEngine } from '../services/queryEngine';
import { DocumentParser } from '../services/documentParser';
import { DocumentStore } from '../services/documentStore';
import { ParentChildRetriever } from '../services/parentChildRetriever';
import { AutoLoader } from '../utils/autoLoader';

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.xlsx', '.xls', '.csv', '.txt', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Initialize services
let dataProcessor: DataProcessor;
let vectorSearch: VectorSearchService;
let queryEngine: QueryEngine;
let documentParser: DocumentParser;
let documentStore: DocumentStore | null = null;
let parentChildRetriever: ParentChildRetriever | null = null;

// Async initialization
async function initializeServices() {
  console.log('🚀 Initializing services with full async support...');

  // Initialize DocumentStore first (for hierarchical chunking)
  const useHierarchicalChunking = process.env.USE_HIERARCHICAL_CHUNKING === 'true';
  if (useHierarchicalChunking) {
    documentStore = new DocumentStore();
    console.log('✅ Document store initialized (hierarchical mode)');
  }

  // Initialize VectorSearch first (shared across all services)
  vectorSearch = new VectorSearchService();
  await vectorSearch.initialize();
  console.log('✅ Vector search initialized');

  // Initialize core services with shared VectorSearch instance
  dataProcessor = new DataProcessor(documentStore || undefined, vectorSearch);
  documentParser = new DocumentParser();

  // Initialize ParentChildRetriever if hierarchical chunking is enabled
  if (useHierarchicalChunking && documentStore) {
    parentChildRetriever = new ParentChildRetriever(vectorSearch, documentStore);
    console.log('✅ Parent-child retriever initialized');
  }

  // Initialize QueryEngine with hierarchical retriever and data processor (if available)
  queryEngine = new QueryEngine(vectorSearch, parentChildRetriever || undefined, dataProcessor);
  console.log(
    `✅ Query engine initialized${parentChildRetriever ? ' (with hierarchical retrieval)' : ''}`
  );

  await dataProcessor.initialize();
  console.log('✅ Data processor initialized');

  console.log('🎯 All services ready with async capabilities');

  // Auto-load demo data if enabled
  if (process.env.AUTO_LOAD_DEMO === 'true') {
    const autoLoader = new AutoLoader(dataProcessor, documentParser);

    // Initialize file tracker if persistence is enabled
    const duckdb = dataProcessor.getDuckDB();
    const db = duckdb.getDatabase();
    if (db) {
      await autoLoader.initialize(db);
    }

    await autoLoader.autoLoadDemoData();
  } else {
    console.log('⏭️  Auto-load disabled (AUTO_LOAD_DEMO=false)');
  }
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    model: 'gpt-5',
    async: true,
  });
});

// Readiness check endpoint - tells if system is ready to answer queries
app.get('/api/readiness', async (req: Request, res: Response) => {
  try {
    const stats = await dataProcessor.getDataStats();
    const vectorStats = await vectorSearch.getStats();

    // System is ready if we have at least 1 document and chunks in vector store
    const isReady = stats.totalDocuments > 0 && vectorStats.totalChunks > 0;

    res.json({
      ready: isReady,
      status: isReady ? 'READY' : 'NOT_READY',
      message: isReady
        ? 'System is ready to answer queries'
        : 'No documents indexed yet. Please upload documents first.',
      documents: {
        total: stats.totalDocuments,
        chunks: vectorStats.totalChunks,
        types: stats.documentTypes,
      },
      features: {
        hierarchicalChunking: process.env.USE_HIERARCHICAL_CHUNKING === 'true',
        agenticRAG: process.env.USE_AGENTIC_RAG === 'true',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      ready: false,
      status: 'ERROR',
      error: 'Failed to check readiness',
    });
  }
});

// Upload endpoint with async processing
app.post('/api/upload', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files)) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Emit progress updates via WebSocket
    io.emit('upload:start', { filesCount: req.files.length });

    const results = await Promise.all(
      req.files.map(async (file, index) => {
        io.emit('upload:progress', {
          current: index + 1,
          total: req.files.length,
          fileName: file.originalname,
        });

        // Parse document asynchronously
        const parsed = await documentParser.parseDocument(file);

        // Process and index asynchronously (includes vector store insertion)
        await dataProcessor.processDocument(parsed);

        return {
          filename: file.originalname,
          size: file.size,
          processed: true,
          chunks: parsed.chunks?.length || 0,
        };
      })
    );

    io.emit('upload:complete', { results });
    res.json({ success: true, results });
  } catch (error) {
    console.error('Upload error:', error);
    io.emit('upload:error', { error: (error as Error).message });
    res.status(500).json({ error: 'Upload processing failed' });
  }
});

// Query endpoint with async RAG
app.post('/api/query', async (req: Request, res: Response) => {
  try {
    const { query, filters = {} } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    io.emit('query:start', { query });

    // Execute query asynchronously using GPT-5
    const result = await queryEngine.executeQuery(query, filters);

    io.emit('query:complete', { result });
    res.json(result);
  } catch (error) {
    console.error('Query error:', error);
    io.emit('query:error', { error: (error as Error).message });
    res.status(500).json({ error: 'Query execution failed' });
  }
});

// Get data statistics
app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const stats = await dataProcessor.getDataStats();
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// WebSocket connection handling
io.on('connection', socket => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Start server
const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    await initializeServices();

    httpServer.listen(PORT, () => {
      // Set server timeout to 4 minutes for long-running agent queries
      httpServer.timeout = 240000; // 4 minutes (GPT-5 + tool calling can be slow)
      httpServer.keepAliveTimeout = 245000; // Slightly longer than timeout

      console.log(`✨ TypeScript PE Analysis Backend running on port ${PORT}`);
      console.log(`🤖 Using GPT-5 model with full async capabilities`);
      console.log(`🔄 WebSocket support enabled for real-time updates`);
      console.log(`⏱️  Request timeout: 240s (for agentic queries)`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  // dataProcessor.cleanup() will handle vectorSearch cleanup (shared instance)
  await dataProcessor?.cleanup();
  documentStore?.clear();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the server
startServer();
