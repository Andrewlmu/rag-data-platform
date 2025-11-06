/**
 * Document Store - In-Memory Storage for Parent Chunks
 *
 * Stores large parent chunks separately from the vector store.
 * Children are stored in vector store for search, parents here for context.
 *
 * Architecture:
 * - Children in VectorStore (searchable, small)
 * - Parents in DocumentStore (retrievable by ID, large)
 */

import type { HierarchicalChunk } from '../types/hierarchical.types';

export class DocumentStore {
  private store: Map<string, HierarchicalChunk>;

  constructor() {
    this.store = new Map();
    console.log('✅ Document Store initialized (in-memory)');
  }

  /**
   * Add a parent chunk to the store
   */
  add(chunk: HierarchicalChunk): void {
    if (chunk.chunkType !== 'parent') {
      console.warn(`⚠️  DocumentStore: Attempted to add non-parent chunk: ${chunk.id}`);
      return;
    }

    this.store.set(chunk.id, chunk);
  }

  /**
   * Add multiple parent chunks
   */
  addMany(chunks: HierarchicalChunk[]): void {
    const parents = chunks.filter(c => c.chunkType === 'parent');
    parents.forEach(chunk => this.store.set(chunk.id, chunk));

    console.log(`📦 Added ${parents.length} parent chunks to document store`);
  }

  /**
   * Get a parent chunk by ID
   */
  get(id: string): HierarchicalChunk | undefined {
    return this.store.get(id);
  }

  /**
   * Get multiple parent chunks by IDs
   */
  getMany(ids: string[]): HierarchicalChunk[] {
    const chunks: HierarchicalChunk[] = [];

    for (const id of ids) {
      const chunk = this.store.get(id);
      if (chunk) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Get all parent chunks for a document
   */
  getByDocument(documentId: string): HierarchicalChunk[] {
    const chunks: HierarchicalChunk[] = [];

    for (const chunk of this.store.values()) {
      if (chunk.metadata.documentId === documentId) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Get parent chunks by section name
   */
  getBySection(section: string): HierarchicalChunk[] {
    const chunks: HierarchicalChunk[] = [];

    for (const chunk of this.store.values()) {
      if (chunk.metadata.section === section) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * Delete a parent chunk
   */
  delete(id: string): boolean {
    return this.store.delete(id);
  }

  /**
   * Delete all parent chunks for a document
   */
  deleteByDocument(documentId: string): number {
    let deleted = 0;

    for (const [id, chunk] of this.store.entries()) {
      if (chunk.metadata.documentId === documentId) {
        this.store.delete(id);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Check if a parent chunk exists
   */
  has(id: string): boolean {
    return this.store.has(id);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalParents: number;
    uniqueDocuments: number;
    uniqueSections: number;
    totalSize: number;
  } {
    const documents = new Set<string>();
    const sections = new Set<string>();
    let totalSize = 0;

    for (const chunk of this.store.values()) {
      documents.add(chunk.metadata.documentId);
      if (chunk.metadata.section) {
        sections.add(chunk.metadata.section);
      }
      totalSize += chunk.content.length;
    }

    return {
      totalParents: this.store.size,
      uniqueDocuments: documents.size,
      uniqueSections: sections.size,
      totalSize,
    };
  }

  /**
   * Clear all parent chunks
   */
  clear(): void {
    this.store.clear();
    console.log('🧹 Document store cleared');
  }

  /**
   * Get all parent IDs
   */
  getAllIds(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get all parent chunks
   */
  getAll(): HierarchicalChunk[] {
    return Array.from(this.store.values());
  }

  /**
   * Search parent chunks by content (simple text search)
   * Note: For semantic search, use VectorStore instead
   */
  searchByContent(query: string, limit: number = 10): HierarchicalChunk[] {
    const results: Array<{ chunk: HierarchicalChunk; score: number }> = [];
    const lowerQuery = query.toLowerCase();

    for (const chunk of this.store.values()) {
      const content = chunk.content.toLowerCase();

      // Simple relevance scoring based on:
      // 1. Query appears in content
      // 2. Position of query (earlier = better)
      // 3. Frequency of query terms

      if (content.includes(lowerQuery)) {
        const position = content.indexOf(lowerQuery);
        const frequency = (content.match(new RegExp(lowerQuery, 'g')) || []).length;

        // Score: frequency * (1 / position_ratio)
        const positionRatio = (position + 1) / content.length;
        const score = frequency * (1 / positionRatio);

        results.push({ chunk, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top N
    return results.slice(0, limit).map(r => r.chunk);
  }
}
