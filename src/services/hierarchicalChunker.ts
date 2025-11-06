/**
 * Hierarchical Chunker - Implements Parent-Child Retrieval Pattern
 *
 * Key Features:
 * - Detects document sections from text patterns
 * - Creates parent chunks (large, for context)
 * - Creates child chunks (small, for precision)
 * - Links parent-child relationships
 * - Enriches metadata (section, hierarchy, content type)
 *
 * Based on 2025 RAG best practices for financial documents
 */

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import type {
  HierarchicalChunk,
  DocumentSection,
  HierarchicalChunkingConfig,
  HierarchicalChunkingStats,
  ContentType,
} from '../types/hierarchical.types';

export class HierarchicalChunker {
  private config: HierarchicalChunkingConfig;
  private parentSplitter: RecursiveCharacterTextSplitter;
  private childSplitter: RecursiveCharacterTextSplitter;

  constructor(config?: Partial<HierarchicalChunkingConfig>) {
    // Default configuration optimized for PE documents
    this.config = {
      parentChunkSize: parseInt(process.env.PARENT_CHUNK_SIZE || '2000'),
      parentChunkOverlap: parseInt(process.env.PARENT_CHUNK_OVERLAP || '200'),
      childChunkSize: parseInt(process.env.CHILD_CHUNK_SIZE || '400'),
      childChunkOverlap: parseInt(process.env.CHILD_CHUNK_OVERLAP || '50'),
      detectSections: true,
      sectionPatterns: [
        // All-caps headings: "EXECUTIVE SUMMARY"
        /^[A-Z][A-Z\s]{3,}$/gm,
        // Title case with colons: "Executive Summary:"
        /^[A-Z][a-zA-Z\s]+:$/gm,
        // Numbered sections: "1. Overview", "1.1 Background"
        /^\d+\.(\d+\.)*\s+[A-Z][a-zA-Z\s]+$/gm,
      ],
      detectTables: true,
      detectLists: true,
      maxHierarchyDepth: 3,
      ...config,
    };

    // Parent splitter (large chunks for context)
    this.parentSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.parentChunkSize,
      chunkOverlap: this.config.parentChunkOverlap,
      separators: ['\n\n\n', '\n\n', '\n', '. ', ' ', ''],
    });

    // Child splitter (small chunks for precision)
    this.childSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.childChunkSize,
      chunkOverlap: this.config.childChunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
  }

  /**
   * Main method: Create hierarchical chunks from document text
   */
  async createHierarchicalChunks(
    text: string,
    documentId: string,
    filename: string
  ): Promise<{
    parents: HierarchicalChunk[];
    children: HierarchicalChunk[];
    stats: HierarchicalChunkingStats;
  }> {
    console.log(`📊 Creating hierarchical chunks for: ${filename}`);

    // Step 1: Detect sections
    const sections = this.config.detectSections ? this.detectSections(text) : [];

    console.log(`   Found ${sections.length} sections`);

    // Step 2: Create parent chunks
    const parents = await this.createParentChunks(text, documentId, filename, sections);

    console.log(`   Created ${parents.length} parent chunks`);

    // Step 3: Create child chunks for each parent
    const children: HierarchicalChunk[] = [];

    for (const parent of parents) {
      const parentChildren = await this.createChildChunks(parent, documentId, filename);
      children.push(...parentChildren);
    }

    console.log(`   Created ${children.length} child chunks`);

    // Step 4: Generate stats
    const stats = this.generateStats(parents, children);

    return { parents, children, stats };
  }

  /**
   * Detect sections from text using patterns
   */
  private detectSections(text: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = text.split('\n');
    let currentPosition = 0;
    let sectionId = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if line matches any section pattern
      const isSection = this.config.sectionPatterns.some(pattern => pattern.test(line));

      if (isSection && line.length > 2) {
        sections.push({
          id: `section_${sectionId++}`,
          title: line,
          level: this.detectSectionLevel(line),
          startPosition: currentPosition,
          endPosition: currentPosition + line.length,
          content: line,
        });
      }

      currentPosition += lines[i].length + 1; // +1 for newline
    }

    return sections;
  }

  /**
   * Detect section level (1=top, 2=sub, 3=subsub)
   */
  private detectSectionLevel(title: string): number {
    // Numbered sections: count dots
    const numberMatch = title.match(/^(\d+\.)+/);
    if (numberMatch) {
      return numberMatch[0].split('.').length - 1;
    }

    // All caps = top level
    if (title === title.toUpperCase()) {
      return 1;
    }

    // Default
    return 2;
  }

  /**
   * Create parent chunks (large, full sections)
   */
  private async createParentChunks(
    text: string,
    documentId: string,
    filename: string,
    sections: DocumentSection[]
  ): Promise<HierarchicalChunk[]> {
    const parentDocs = await this.parentSplitter.createDocuments([text]);
    const parents: HierarchicalChunk[] = [];

    for (let i = 0; i < parentDocs.length; i++) {
      const doc = parentDocs[i];
      const content = doc.pageContent;

      // Find which section this chunk belongs to
      const section = this.findSectionForText(content, sections);

      const parent: HierarchicalChunk = {
        id: `${documentId}_parent_${i}`,
        content: content,
        chunkType: 'parent',
        childIds: [], // Will be filled when creating children
        metadata: {
          filename,
          documentId,
          section: section?.title,
          hierarchyLevel: section?.level || 0,
          contentType: this.detectContentType(content),
          chunkIndex: i,
          chunkTotal: parentDocs.length,
          charCount: content.length,
          wordCount: content.split(/\s+/).length,
          createdAt: new Date().toISOString(),
        },
      };

      parents.push(parent);
    }

    return parents;
  }

  /**
   * Create child chunks from a parent chunk
   */
  private async createChildChunks(
    parent: HierarchicalChunk,
    documentId: string,
    filename: string
  ): Promise<HierarchicalChunk[]> {
    const childDocs = await this.childSplitter.createDocuments([parent.content]);
    const children: HierarchicalChunk[] = [];

    for (let i = 0; i < childDocs.length; i++) {
      const doc = childDocs[i];
      const content = doc.pageContent;

      const childId = `${parent.id}_child_${i}`;

      const child: HierarchicalChunk = {
        id: childId,
        content: content,
        chunkType: 'child',
        parentId: parent.id,
        metadata: {
          filename,
          documentId,
          section: parent.metadata.section,
          hierarchyLevel: (parent.metadata.hierarchyLevel || 0) + 1,
          contentType: this.detectContentType(content),
          chunkIndex: i,
          chunkTotal: childDocs.length,
          charCount: content.length,
          wordCount: content.split(/\s+/).length,
          createdAt: new Date().toISOString(),
        },
      };

      children.push(child);

      // Link child to parent
      parent.childIds!.push(childId);
    }

    return children;
  }

  /**
   * Find which section a text chunk belongs to
   */
  private findSectionForText(
    text: string,
    sections: DocumentSection[]
  ): DocumentSection | undefined {
    // Simple heuristic: find section title in text
    for (const section of sections) {
      if (text.includes(section.title)) {
        return section;
      }
    }

    return undefined;
  }

  /**
   * Detect content type from text patterns
   */
  private detectContentType(text: string): ContentType {
    // Table detection: look for pipe characters or multiple tabs
    if (this.config.detectTables) {
      if (text.includes('|') || text.match(/\t.*\t/)) {
        return 'table';
      }
    }

    // List detection: bullet points or numbers
    if (this.config.detectLists) {
      if (text.match(/^[\s]*[-•*]\s/m) || text.match(/^[\s]*\d+\.\s/m)) {
        return 'list';
      }
    }

    // Heading detection: short, all-caps or title case
    if (text.length < 100 && text === text.toUpperCase()) {
      return 'heading';
    }

    // Paragraph (default)
    return 'paragraph';
  }

  /**
   * Generate statistics
   */
  private generateStats(
    parents: HierarchicalChunk[],
    children: HierarchicalChunk[]
  ): HierarchicalChunkingStats {
    const contentTypes: Record<ContentType, number> = {
      text: 0,
      table: 0,
      list: 0,
      heading: 0,
      paragraph: 0,
    };

    [...parents, ...children].forEach(chunk => {
      contentTypes[chunk.metadata.contentType]++;
    });

    const sectionsDetected = new Set(
      [...parents, ...children].map(c => c.metadata.section).filter(s => s !== undefined)
    ).size;

    const maxDepth = Math.max(
      ...parents.map(p => p.metadata.hierarchyLevel || 0),
      ...children.map(c => c.metadata.hierarchyLevel || 0)
    );

    return {
      totalParents: parents.length,
      totalChildren: children.length,
      avgChildrenPerParent: children.length / parents.length,
      sectionsDetected,
      hierarchyDepth: maxDepth,
      contentTypes,
    };
  }
}
