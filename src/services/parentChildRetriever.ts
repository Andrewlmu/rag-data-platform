/**
 * Parent-Child Retriever - Orchestrates Hierarchical Retrieval
 *
 * Implements the 2025 best practice pattern:
 * 1. Search with small chunks (precision)
 * 2. Retrieve parent context (completeness)
 * 3. Return both for optimal LLM performance
 *
 * Flow:
 * Query → VectorStore (finds children) → Get parentIds → DocumentStore (fetch parents) → Return enhanced results
 */

import type { VectorSearchService } from './vectorSearch';
import type { DocumentStore } from './documentStore';
import type { HierarchicalChunk, ParentChildRetrievalResult } from '../types/hierarchical.types';

export interface EnhancedSearchResult {
  childChunk: string;
  childMetadata: Record<string, any>;
  childSimilarity: number;
  parentChunk?: string;
  parentMetadata?: Record<string, any>;
  section?: string;
  hierarchyPath?: string[];
}

export class ParentChildRetriever {
  private vectorSearch: VectorSearchService;
  private documentStore: DocumentStore;

  constructor(vectorSearch: VectorSearchService, documentStore: DocumentStore) {
    this.vectorSearch = vectorSearch;
    this.documentStore = documentStore;

    console.log('✅ ParentChildRetriever initialized');
  }

  /**
   * Main retrieval method with parent-child lookup
   *
   * @param query - Search query
   * @param k - Number of results to return
   * @param filters - Optional filters
   * @returns Enhanced results with parent context
   */
  async retrieve(
    query: string,
    k: number = 5,
    filters?: Record<string, any>
  ): Promise<EnhancedSearchResult[]> {
    // Step 1: Search vector store for child chunks
    const childResults = await this.vectorSearch.search(query, k, filters);

    if (!childResults || childResults.length === 0) {
      return [];
    }

    // Step 2: Extract parent IDs from child chunks
    const parentIds = childResults
      .map(result => result.metadata?.parentId)
      .filter(id => id !== undefined) as string[];

    // Get unique parent IDs
    const uniqueParentIds = [...new Set(parentIds)];

    // Step 3: Fetch parent chunks from document store
    const parents = this.documentStore.getMany(uniqueParentIds);
    const parentMap = new Map(parents.map(p => [p.id, p]));

    // Step 4: Build enhanced results
    const enhancedResults: EnhancedSearchResult[] = childResults.map(childResult => {
      const parentId = childResult.metadata?.parentId;
      const parent = parentId ? parentMap.get(parentId) : undefined;

      return {
        childChunk: childResult.content,
        childMetadata: childResult.metadata || {},
        childSimilarity: childResult.score || 0,
        parentChunk: parent?.content,
        parentMetadata: parent?.metadata,
        section: parent?.metadata?.section || childResult.metadata?.section,
        hierarchyPath: this.buildHierarchyPath(parent),
      };
    });

    console.log(
      `📊 Retrieved ${enhancedResults.length} results (${uniqueParentIds.length} unique parents)`
    );

    return enhancedResults;
  }

  /**
   * Retrieve with section filtering
   */
  async retrieveBySection(
    query: string,
    section: string,
    k: number = 5
  ): Promise<EnhancedSearchResult[]> {
    // Search with section filter
    const results = await this.retrieve(query, k * 2); // Get more to filter

    // Filter by section
    const filtered = results.filter(r => r.section === section);

    // Return top k
    return filtered.slice(0, k);
  }

  /**
   * Get full parent context for a list of child chunk IDs
   */
  async getParentContext(childIds: string[]): Promise<HierarchicalChunk[]> {
    // This assumes child IDs contain parent ID
    // Format: parentId_child_N
    const parentIds = childIds
      .map(childId => {
        const parts = childId.split('_child_');
        return parts.length > 0 ? parts[0] : null;
      })
      .filter(id => id !== null) as string[];

    const uniqueParentIds = [...new Set(parentIds)];
    return this.documentStore.getMany(uniqueParentIds);
  }

  /**
   * Build hierarchy path for breadcrumb-style navigation
   */
  private buildHierarchyPath(chunk?: HierarchicalChunk): string[] {
    if (!chunk) return [];

    const path: string[] = [];

    // Add document name
    if (chunk.metadata.filename) {
      path.push(chunk.metadata.filename);
    }

    // Add section
    if (chunk.metadata.section) {
      path.push(chunk.metadata.section);
    }

    // Add subsection if exists
    if (chunk.metadata.subsection) {
      path.push(chunk.metadata.subsection);
    }

    return path;
  }

  /**
   * Get statistics about retrieval
   */
  getStats(): {
    totalParents: number;
    vectorStoreSize: number;
  } {
    const docStoreStats = this.documentStore.getStats();

    return {
      totalParents: docStoreStats.totalParents,
      vectorStoreSize: 0, // Could add if vectorSearch exposes this
    };
  }

  /**
   * Clear all stored data
   */
  clear(): void {
    this.documentStore.clear();
    console.log('🧹 ParentChildRetriever cleared');
  }
}
