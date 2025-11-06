import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from 'langchain/document';

export interface SearchResult {
  content: string;
  metadata: Record<string, any>;
  score: number;
}

/**
 * Simplified Vector Search using in-memory store
 * No external ChromaDB dependency - works immediately!
 */
export class VectorSearchService {
  private vectorStore: MemoryVectorStore;
  private embeddings: OpenAIEmbeddings;
  private documents: Map<string, Document> = new Map();

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      openAIApiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 3,
    });

    // Initialize in-memory vector store
    this.vectorStore = new MemoryVectorStore(this.embeddings);
  }

  async initialize(): Promise<void> {
    console.log('✅ In-memory vector store initialized');
    return Promise.resolve();
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

      // Store reference
      documents.forEach(doc => {
        const key = `${doc.metadata.documentId}_${doc.metadata.chunkIndex}`;
        this.documents.set(key, doc);
      });

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
      // Perform similarity search
      const results = await this.vectorStore.similaritySearchWithScore(query, k, filter);

      // Format results
      const searchResults: SearchResult[] = results.map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: doc.metadata || {},
        score: 1 - score, // Convert distance to similarity score
      }));

      return searchResults;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    // In-memory implementation: filter out documents
    const keysToDelete: string[] = [];
    this.documents.forEach((doc, key) => {
      if (doc.metadata?.documentId === documentId) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.documents.delete(key));
    console.log(`🗑️ Deleted document: ${documentId}`);
  }

  async getStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
  }> {
    const uniqueDocs = new Set<string>();
    this.documents.forEach(doc => {
      if (doc.metadata?.documentId) {
        uniqueDocs.add(doc.metadata.documentId);
      }
    });

    return {
      totalDocuments: uniqueDocs.size,
      totalChunks: this.documents.size,
    };
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up vector store...');
    this.documents.clear();
  }
}
