/**
 * Types for Hierarchical Document Organization & Parent-Child Retrieval
 *
 * This implements the 2025 best practice of parent-child retrieval:
 * - Search with small chunks (precision)
 * - Return large context (completeness)
 */

/**
 * Type of chunk in the hierarchy
 */
export type ChunkType = 'parent' | 'child';

/**
 * Type of content in the chunk
 */
export type ContentType = 'text' | 'table' | 'list' | 'heading' | 'paragraph';

/**
 * Hierarchical chunk with parent-child relationships
 */
export interface HierarchicalChunk {
  id: string;
  content: string;

  // Parent-child relationships
  chunkType: ChunkType;
  parentId?: string; // ID of parent chunk (if this is a child)
  childIds?: string[]; // IDs of children (if this is a parent)

  // Structural metadata
  metadata: {
    // Document info
    filename: string;
    documentId: string;

    // Hierarchical structure
    section?: string; // e.g., "Executive Summary", "Risk Factors"
    subsection?: string; // e.g., "Revenue Breakdown", "Key Metrics"
    hierarchyLevel: number; // 0=document, 1=section, 2=subsection, 3=paragraph

    // Content classification
    contentType: ContentType;

    // Positional info
    chunkIndex: number;
    chunkTotal: number;
    startPosition?: number; // Character position in original doc
    endPosition?: number;

    // Size info
    charCount: number;
    wordCount: number;

    // Timestamps
    createdAt: string;

    // Additional metadata (flexible)
    [key: string]: any;
  };
}

/**
 * Section detected in document
 */
export interface DocumentSection {
  id: string;
  title: string;
  level: number; // 1=top-level, 2=subsection, etc.
  startPosition: number;
  endPosition: number;
  content: string;
  children?: DocumentSection[];
}

/**
 * Result from parent-child retrieval
 */
export interface ParentChildRetrievalResult {
  // The child chunk that matched the query
  childChunk: HierarchicalChunk;
  childSimilarity: number;

  // The parent chunk with full context
  parentChunk: HierarchicalChunk;

  // Combined for convenience
  combinedContent: string; // Parent content with child highlighted

  // Metadata
  section?: string;
  hierarchyPath: string[]; // e.g., ["Executive Summary", "Key Metrics"]
}

/**
 * Configuration for hierarchical chunking
 */
export interface HierarchicalChunkingConfig {
  // Parent chunk settings (large, for context)
  parentChunkSize: number; // Default: 2000 chars
  parentChunkOverlap: number; // Default: 200 chars

  // Child chunk settings (small, for precision)
  childChunkSize: number; // Default: 400 chars
  childChunkOverlap: number; // Default: 50 chars

  // Section detection
  detectSections: boolean; // Default: true
  sectionPatterns: RegExp[]; // Patterns to detect section headings

  // Content type detection
  detectTables: boolean; // Default: true
  detectLists: boolean; // Default: true

  // Hierarchy settings
  maxHierarchyDepth: number; // Default: 3
}

/**
 * Statistics for hierarchical chunking
 */
export interface HierarchicalChunkingStats {
  totalParents: number;
  totalChildren: number;
  avgChildrenPerParent: number;
  sectionsDetected: number;
  hierarchyDepth: number;
  contentTypes: Record<ContentType, number>;
}
