'use client';

import { useState } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import axios from 'axios';

interface QueryResult {
  answer: string;
  sources: Array<{
    content: string;
    metadata: Record<string, any>;
  }>;
  confidence: number;
  processingTime: number;
}

export default function QueryInterface() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sampleQueries = [
    "What is the life expectancy in Afghanistan?",
    "Which countries have the highest infant mortality rates?",
    "Show maternal mortality trends across regions",
    "Compare suicide rates between countries",
    "What are the main causes of death globally?"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Set 2-minute timeout for long-running agent queries
      const response = await axios.post('/api/query', { query }, {
        timeout: 120000, // 2 minutes for GPT-5 + tool calling
      });
      setResult(response.data);
    } catch (err) {
      setError('Failed to process query. Please try again.');
      console.error('Query error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSampleQuery = (sampleQuery: string) => {
    setQuery(sampleQuery);
  };

  return (
    <div className="space-y-6">
      {/* Query Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about global health data..."
            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            rows={3}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute bottom-3 right-3 p-2 text-primary-600 hover:text-primary-700 disabled:text-gray-400 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>

        {/* Sample Queries */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Try these sample queries:</p>
          <div className="flex flex-wrap gap-2">
            {sampleQueries.map((sq, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSampleQuery(sq)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="text-center space-y-3">
            <Sparkles className="animate-pulse mx-auto text-primary-600" size={32} />
            <p className="text-gray-600">Processing with GPT-5...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Answer */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start space-x-3 mb-4">
              <Sparkles className="text-primary-600 mt-1" size={20} />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">Answer</h3>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {result.answer}
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center space-x-4 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">
              <span>Confidence: {result.confidence}%</span>
              <span>•</span>
              <span>Processing: {result.processingTime}ms</span>
              <span>•</span>
              <span>{result.sources.length} sources</span>
            </div>
          </div>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Sources</h4>
              <div className="space-y-2">
                {result.sources.map((source, index) => (
                  <details
                    key={index}
                    className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <summary className="px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors">
                      <span className="font-medium text-sm">
                        Source {index + 1}: {source.metadata.filename || source.metadata.source || 'Document'}
                      </span>
                    </summary>
                    <div className="px-4 py-3 border-t border-gray-200 bg-white">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {source.content}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}