import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { VectorSearchService } from './vectorSearch';
import { AgenticRAG } from '../agents/agenticRAG';
import { ParentChildRetriever, EnhancedSearchResult } from './parentChildRetriever';

export interface QueryResult {
  answer: string;
  sources: Array<{
    content: string;
    metadata: Record<string, any>;
  }>;
  confidence: number;
  processingTime: number;
  reasoning?: {
    thoughts: string[];
    toolsUsed: string[];
    loopCount: number;
  };
}

export class QueryEngine {
  private llm: ChatOpenAI;
  private vectorSearch: VectorSearchService;
  private parentChildRetriever: ParentChildRetriever | null = null;
  private agenticRAG: AgenticRAG | null = null;

  constructor(vectorSearch: VectorSearchService, parentChildRetriever?: ParentChildRetriever) {
    this.vectorSearch = vectorSearch;
    this.parentChildRetriever = parentChildRetriever || null;

    // Initialize Agentic RAG if enabled
    if (process.env.USE_AGENTIC_RAG === 'true') {
      try {
        this.agenticRAG = new AgenticRAG(vectorSearch, parentChildRetriever);
        console.log('🤖 Agentic RAG enabled');
      } catch (error) {
        console.error('❌ Failed to initialize Agentic RAG:', error);
        console.log('📄 Falling back to basic RAG');
      }
    } else {
      console.log('📄 Using Basic RAG (USE_AGENTIC_RAG=false)');
    }

    // Initialize GPT-5 with async streaming support (using gpt-4-turbo for now)
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4-turbo',
      temperature: 0,
      maxTokens: 4096,
      openAIApiKey: process.env.OPENAI_API_KEY,
      streaming: true,
    });
  }

  async executeQuery(query: string, filters?: Record<string, any>): Promise<QueryResult> {
    const startTime = Date.now();

    // Try Agentic RAG first if available
    if (this.agenticRAG) {
      try {
        console.log('🤖 Routing to Agentic RAG');

        const agenticResult = await this.agenticRAG.query(query);

        // Convert agentic result to standard QueryResult format
        // Calculate confidence based on sources (if we have sources with good similarity scores)
        let confidence = 0.85; // Default high confidence for agentic
        if (agenticResult.sources.length > 0) {
          const avgSimilarity =
            agenticResult.sources.reduce((sum, s) => sum + (s.similarity || 0), 0) /
            agenticResult.sources.length;
          confidence = Math.min(0.95, 0.7 + avgSimilarity * 0.25); // 70-95% range
        }

        return {
          answer: agenticResult.answer,
          sources: agenticResult.sources.map(s => ({
            content: s.chunk,
            metadata: { filename: s.filename, similarity: s.similarity },
          })),
          confidence: confidence, // 0.85-0.95 for agentic (displayed as 85-95%)
          processingTime: agenticResult.metadata.duration,
          reasoning: agenticResult.reasoning,
        };
      } catch (error) {
        console.error('❌ Agentic RAG failed:', error);
        console.log('📄 Falling back to Basic RAG');
        // Fall through to basic RAG
      }
    }

    // Basic RAG (fallback or default)
    console.log('📄 Using Basic RAG');

    try {
      // Use hierarchical retrieval if available, otherwise fallback to standard search
      if (this.parentChildRetriever) {
        console.log('   Using hierarchical retrieval (parent-child)');
        const enhancedResults = await this.parentChildRetriever.retrieve(query, 10, filters);
        const context = this.buildHierarchicalContext(enhancedResults);

        // Build QueryResult from enhanced results
        return await this.buildQueryResultFromEnhanced(query, enhancedResults, context, startTime);
      }

      // Standard search (fallback)
      console.log('   Using standard search');
      const searchResults = await this.vectorSearch.search(query, 10, filters);

      // Build context from search results
      const context = this.buildContext(searchResults);

      // Create the prompt
      const systemPrompt = `You are an expert Private Equity analyst with deep knowledge of financial analysis, due diligence, and investment evaluation. You have access to a comprehensive database of PE-related documents and data.

Your task is to provide accurate, insightful answers based on the provided context. Always:
1. Be specific and cite the relevant sources
2. Highlight key financial metrics when relevant
3. Identify risks and opportunities
4. Provide actionable insights
5. Acknowledge if information is incomplete or unclear

You are powered by GPT-5, the most advanced AI model as of November 2025.

Context from the database:
${context}`;

      const userPrompt = `Question: ${query}

Please provide a comprehensive answer based on the available data.`;

      // Get response from GPT-5
      const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];

      const response = await this.llm.invoke(messages);

      // Calculate confidence based on search results
      const confidence = this.calculateConfidence(searchResults);

      const processingTime = Date.now() - startTime;

      return {
        answer: response.content.toString(),
        sources: searchResults.slice(0, 5).map(r => ({
          content: r.content,
          metadata: r.metadata,
        })),
        confidence,
        processingTime,
      };
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    }
  }

  async executeStreamingQuery(
    query: string,
    filters?: Record<string, any>,
    onToken?: (token: string) => void
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // Search for relevant documents
      const searchResults = await this.vectorSearch.search(query, 10, filters);
      const context = this.buildContext(searchResults);

      const systemPrompt = `You are an expert PE analyst using GPT-5. Provide accurate, insightful answers based on the context.

Context: ${context}`;

      const messages = [new SystemMessage(systemPrompt), new HumanMessage(query)];

      // Stream the response
      let fullResponse = '';
      const stream = await this.llm.stream(messages);

      for await (const chunk of stream) {
        const token = chunk.content.toString();
        fullResponse += token;
        if (onToken) {
          onToken(token);
        }
      }

      const confidence = this.calculateConfidence(searchResults);
      const processingTime = Date.now() - startTime;

      return {
        answer: fullResponse,
        sources: searchResults.slice(0, 5).map(r => ({
          content: r.content,
          metadata: r.metadata,
        })),
        confidence,
        processingTime,
      };
    } catch (error) {
      console.error('Streaming query error:', error);
      throw error;
    }
  }

  async analyzeDataQuality(query?: string): Promise<{
    insights: string;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      // Get sample data from vector store
      const sampleResults = await this.vectorSearch.search(
        query || 'financial data quality metrics revenue EBITDA',
        20
      );

      const context = this.buildContext(sampleResults);

      const prompt = `Analyze the data quality in our PE database. Based on the following sample data, identify:
1. Data quality issues
2. Missing information
3. Inconsistencies
4. Recommendations for improvement

Sample data:
${context}

Provide a structured analysis focusing on completeness, accuracy, and consistency.`;

      const messages = [
        new SystemMessage('You are a data quality expert analyzing PE data using GPT-5.'),
        new HumanMessage(prompt),
      ];

      const response = await this.llm.invoke(messages);
      const analysis = response.content.toString();

      // Parse the analysis to extract structured information
      const issues = this.extractIssues(analysis);
      const recommendations = this.extractRecommendations(analysis);

      return {
        insights: analysis,
        issues,
        recommendations,
      };
    } catch (error) {
      console.error('Data quality analysis error:', error);
      throw error;
    }
  }

  private buildContext(searchResults: any[]): string {
    if (searchResults.length === 0) {
      return 'No relevant documents found in the database.';
    }

    return searchResults
      .map((result, index) => {
        const metadata = result.metadata || {};
        const source = metadata.source || 'Unknown source';
        const type = metadata.type || 'Document';

        return `[Source ${index + 1}] (${type} - ${source}):
${result.content}
---`;
      })
      .join('\n\n');
  }

  private calculateConfidence(searchResults: any[]): number {
    if (searchResults.length === 0) return 0;

    // Calculate confidence based on search result scores
    // Lower scores mean better matches in ChromaDB
    const avgScore =
      searchResults.reduce((acc, r) => acc + (r.score || 1), 0) / searchResults.length;

    // Convert to confidence percentage (inverse of distance)
    const confidence = Math.max(0, Math.min(100, (1 - avgScore) * 100));

    return Math.round(confidence);
  }

  private extractIssues(analysis: string): string[] {
    const issues: string[] = [];
    const lines = analysis.split('\n');

    for (const line of lines) {
      if (
        line.includes('missing') ||
        line.includes('incomplete') ||
        line.includes('inconsistent')
      ) {
        issues.push(line.trim());
      }
    }

    return issues.slice(0, 5); // Return top 5 issues
  }

  private extractRecommendations(analysis: string): string[] {
    const recommendations: string[] = [];
    const lines = analysis.split('\n');

    for (const line of lines) {
      if (line.includes('recommend') || line.includes('should') || line.includes('consider')) {
        recommendations.push(line.trim());
      }
    }

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }

  /**
   * Build context from hierarchical (parent-child) search results
   * Includes both matched child chunks and full parent context
   */
  private buildHierarchicalContext(results: EnhancedSearchResult[]): string {
    if (results.length === 0) {
      return 'No relevant documents found in the database.';
    }

    return results
      .map((result, index) => {
        const hierarchyPath = result.hierarchyPath?.join(' > ') || 'Unknown';
        const filename = result.childMetadata.filename || 'Unknown';
        const section = result.section || 'No section';

        // Build context with both child (matched) and parent (full context)
        let contextStr = `[Source ${index + 1}] ${filename} > ${section}
Hierarchy: ${hierarchyPath}

📍 Matched Section (Similarity: ${result.childSimilarity.toFixed(3)}):
${result.childChunk}`;

        // Add parent context if available (provides surrounding context)
        if (result.parentChunk) {
          contextStr += `

📄 Full Context (Parent Chunk):
${result.parentChunk}`;
        }

        contextStr += '\n---';
        return contextStr;
      })
      .join('\n\n');
  }

  /**
   * Build QueryResult from enhanced hierarchical results
   */
  private async buildQueryResultFromEnhanced(
    query: string,
    enhancedResults: EnhancedSearchResult[],
    context: string,
    startTime: number
  ): Promise<QueryResult> {
    // Create the prompt with hierarchical context
    const systemPrompt = `You are an expert Private Equity analyst with deep knowledge of financial analysis, due diligence, and investment evaluation. You have access to a comprehensive database of PE-related documents and data.

Your task is to provide accurate, insightful answers based on the provided context. The context includes both:
1. Precisely matched sections (marked with 📍) - these are the most relevant chunks
2. Full parent context (marked with 📄) - this provides complete surrounding information

Always:
1. Be specific and cite the relevant sources
2. Highlight key financial metrics when relevant
3. Identify risks and opportunities
4. Provide actionable insights
5. Acknowledge if information is incomplete or unclear

You are powered by GPT-5, the most advanced AI model as of November 2025.

Context from the database:
${context}`;

    const userPrompt = `Question: ${query}

Please provide a comprehensive answer based on the available data.`;

    // Get response from GPT-5
    const messages = [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)];
    const response = await this.llm.invoke(messages);

    // Calculate confidence based on child similarities
    const avgSimilarity =
      enhancedResults.reduce((sum, r) => sum + r.childSimilarity, 0) / enhancedResults.length;
    const confidence = Math.round(Math.min(95, 70 + avgSimilarity * 25)); // 70-95% range

    const processingTime = Date.now() - startTime;

    return {
      answer: response.content.toString(),
      sources: enhancedResults.slice(0, 5).map(r => ({
        content: r.parentChunk || r.childChunk, // Prefer parent for full context
        metadata: {
          ...r.childMetadata,
          section: r.section,
          hierarchyPath: r.hierarchyPath?.join(' > '),
          similarity: r.childSimilarity,
        },
      })),
      confidence,
      processingTime,
    };
  }
}
