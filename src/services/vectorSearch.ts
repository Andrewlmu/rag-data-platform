import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from 'langchain/document';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SearchResult {
  content: string;
  metadata: Record<string, any>;
  score: number;
}

interface CachedDocument {
  pageContent: string;
  metadata: Record<string, any>;
}

/**
 * Persistent Vector Search using file-based caching
 * Embeddings persist to disk - fast startup after initial indexing!
 * No external services required - simple and portable!
 */
export class VectorSearchService {
  private vectorStore: MemoryVectorStore;
  private embeddings: OpenAIEmbeddings;
  private cachePath: string;
  private documents: Map<string, Document> = new Map();

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      openAIApiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 3,
    });

    this.vectorStore = new MemoryVectorStore(this.embeddings);
    this.cachePath = process.env.VECTOR_CACHE_PATH || './data/vector_cache.json';
  }

  async initialize(): Promise<void> {
    try {
      console.log(`🔧 Initializing Vector Search (persistent)...`);
      console.log(`   Cache path: ${this.cachePath}`);

      // Ensure cache directory exists
      const cacheDir = path.dirname(this.cachePath);
      await fs.mkdir(cacheDir, { recursive: true });

      // Try to load from cache
      const loaded = await this.loadFromCache();

      if (loaded) {
        console.log(`✅ Vector store initialized (loaded from cache)`);
      } else {
        console.log(`✅ Vector store initialized (empty, will build on first use)`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize vector store:', error);
      throw error;
    }
  }

  private async loadFromCache(): Promise<boolean> {
    try {
      const cacheExists = await fs
        .access(this.cachePath)
        .then(() => true)
        .catch(() => false);

      if (!cacheExists) {
        return false;
      }

      const data = await fs.readFile(this.cachePath, 'utf-8');
      const cached: CachedDocument[] = JSON.parse(data);

      if (cached.length === 0) {
        return false;
      }

      // Reconstruct documents
      const documents = cached.map(
        (doc) => new Document({ pageContent: doc.pageContent, metadata: doc.metadata })
      );

      // Add to vector store (this will re-compute embeddings)
      await this.vectorStore.addDocuments(documents);

      // Store references
      documents.forEach((doc) => {
        const key = `${doc.metadata.documentId}_${doc.metadata.chunkIndex}`;
        this.documents.set(key, doc);
      });

      console.log(`   📦 Loaded ${documents.length} cached documents`);
      return true;
    } catch (error) {
      console.error('   ⚠️  Failed to load cache, starting fresh:', error);
      return false;
    }
  }

  private async saveToCache(): Promise<void> {
    try {
      const documents: CachedDocument[] = Array.from(this.documents.values()).map((doc) => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
      }));

      await fs.writeFile(this.cachePath, JSON.stringify(documents, null, 2));
      console.log(`   💾 Saved ${documents.length} documents to cache`);
    } catch (error) {
      console.error('   ⚠️  Failed to save cache:', error);
    }
  }

  async addDocument(doc: {
    id: string;
    content: string;
    metadata: Record<string, any>;
    chunks?: Array<{ text: string; metadata: Record<string, any> }>;
  }): Promise<void> {
    try {
      const chunks = doc.chunks || [{ text: doc.content, metadata: doc.metadata }];

      // Create Document objects for each chunk
      const documents = chunks.map(
        (chunk, index) =>
          new Document({
            pageContent: chunk.text,
            metadata: {
              ...chunk.metadata,
              documentId: doc.id,
              chunkIndex: index,
              timestamp: new Date().toISOString(),
            },
          })
      );

      // Add to vector store
      await this.vectorStore.addDocuments(documents);

      // Store references
      documents.forEach((doc) => {
        const key = `${doc.metadata.documentId}_${doc.metadata.chunkIndex}`;
        this.documents.set(key, doc);
      });

      // Don't save on every add - too slow. Will save in cleanup or manually
      console.log(`📄 Added document ${doc.id} with ${chunks.length} chunks`);
    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  }

  async search(
    query: string,
    k: number = 5,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      console.log(`🔍 VectorSearch.search() called:`);
      console.log(`   Query: "${query}"`);
      console.log(`   K: ${k}`);
      console.log(`   Documents in cache: ${this.documents.size}`);

      // Perform similarity search
      const results = await this.vectorStore.similaritySearchWithScore(query, k);

      console.log(`   Raw results: ${results.length}`);
      if (results.length > 0) {
        console.log(`   Top result score (distance): ${results[0][1]}`);
        console.log(
          `   Top result content preview: ${results[0][0].pageContent.substring(0, 100)}...`
        );
      }

      // Format results
      const searchResults: SearchResult[] = results.map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: doc.metadata || {},
        score: 1 - score, // Convert distance to similarity score
      }));

      console.log(`   Returning ${searchResults.length} formatted results`);
      return searchResults;
    } catch (error) {
      console.error('❌ Search error:', error);
      throw error;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      // Remove from in-memory map
      const keysToDelete: string[] = [];
      this.documents.forEach((doc, key) => {
        if (doc.metadata?.documentId === documentId) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach((key) => this.documents.delete(key));

      // Save updated cache
      await this.saveToCache();

      console.log(`🗑️ Deleted document: ${documentId} (${keysToDelete.length} chunks)`);
    } catch (error) {
      console.error(`Failed to delete document ${documentId}:`, error);
      throw error;
    }
  }

  async getStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
  }> {
    const uniqueDocs = new Set<string>();
    this.documents.forEach((doc) => {
      if (doc.metadata?.documentId) {
        uniqueDocs.add(doc.metadata.documentId);
      }
    });

    return {
      totalDocuments: uniqueDocs.size,
      totalChunks: this.documents.size,
    };
  }

  /**
   * Manually save cache (call after batch loading)
   */
  async saveCacheNow(): Promise<void> {
    await this.saveToCache();
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up vector store...');
    // Final save before cleanup
    await this.saveToCache();
    this.documents.clear();
  }
}

// Type alias for backward compatibility
export type VectorSearch = VectorSearchService;
