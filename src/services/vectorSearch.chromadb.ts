import { ChromaClient, Collection } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from 'langchain/document';

export interface SearchResult {
  content: string;
  metadata: Record<string, any>;
  score: number;
}

export class VectorSearchService {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private embeddings: OpenAIEmbeddings;
  private readonly collectionName = 'pe_analysis_data';

  constructor() {
    this.client = new ChromaClient({
      path: 'http://localhost:8001'
    });
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      openAIApiKey: process.env.OPENAI_API_KEY
    });
  }

  async initialize(): Promise<void> {
    try {
      // Delete existing collection if it exists
      const collections = await this.client.listCollections();
      if (collections.some(c => c.name === this.collectionName)) {
        await this.client.deleteCollection({ name: this.collectionName });
      }

      // Create new collection
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        metadata: { description: 'PE analysis data with GPT-5' }
      });

      console.log('✅ Vector store initialized with collection:', this.collectionName);
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

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
      // Process chunks if available, otherwise treat whole content as single chunk
      const chunks = doc.chunks || [{ text: doc.content, metadata: doc.metadata }];

      // Generate embeddings for all chunks in parallel
      const embedPromises = chunks.map(chunk =>
        this.embeddings.embedQuery(chunk.text)
      );
      const embeddings = await Promise.all(embedPromises);

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
        embeddings,
        documents,
        metadatas
      });

      console.log(`📄 Added document ${doc.id} with ${chunks.length} chunks`);
    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  }

  async search(query: string, k: number = 5, filter?: Record<string, any>): Promise<SearchResult[]> {
    if (!this.collection) {
      throw new Error('Vector store not initialized');
    }

    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddings.embedQuery(query);

      // Search in collection
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

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.collection) {
      throw new Error('Vector store not initialized');
    }

    try {
      await this.collection.delete({
        where: { documentId }
      });
      console.log(`🗑️ Deleted document: ${documentId}`);
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw error;
    }
  }

  async getStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
  }> {
    if (!this.collection) {
      throw new Error('Vector store not initialized');
    }

    try {
      const count = await this.collection.count();

      // Get unique document IDs
      const results = await this.collection.get();
      const uniqueDocs = new Set(
        results.metadatas?.map(m => m?.documentId).filter(Boolean)
      );

      return {
        totalDocuments: uniqueDocs.size,
        totalChunks: count
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return { totalDocuments: 0, totalChunks: 0 };
    }
  }

  async cleanup(): Promise<void> {
    if (this.collection) {
      console.log('🧹 Cleaning up vector store...');
      // ChromaDB client doesn't need explicit cleanup
      this.collection = null;
    }
  }
}