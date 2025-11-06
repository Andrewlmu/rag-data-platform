'use client';

import { FileText, ExternalLink, Clock, BarChart } from 'lucide-react';

interface Result {
  answer: string;
  sources: Array<{
    content: string;
    metadata: Record<string, any>;
  }>;
  confidence: number;
  processingTime: number;
}

interface ResultsDisplayProps {
  result: Result | null;
  isLoading?: boolean;
}

export default function ResultsDisplay({ result, isLoading }: ResultsDisplayProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Main Answer */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Analysis Result</h3>
        <div className="prose prose-sm max-w-none text-gray-700">
          <p className="whitespace-pre-wrap">{result.answer}</p>
        </div>

        {/* Metrics */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            <BarChart className="text-gray-400" size={16} />
            <span className="text-sm text-gray-600">
              Confidence: <span className="font-medium">{result.confidence}%</span>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="text-gray-400" size={16} />
            <span className="text-sm text-gray-600">
              Processing: <span className="font-medium">{result.processingTime}ms</span>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <FileText className="text-gray-400" size={16} />
            <span className="text-sm text-gray-600">
              Sources: <span className="font-medium">{result.sources.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Source Documents */}
      {result.sources.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Source Documents</h3>
          <div className="space-y-3">
            {result.sources.map((source, index) => (
              <div
                key={index}
                className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <FileText className="text-gray-400" size={16} />
                    <span className="text-sm font-medium text-gray-900">
                      {source.metadata.filename || source.metadata.source || `Source ${index + 1}`}
                    </span>
                  </div>
                  {source.metadata.type && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                      {source.metadata.type}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 line-clamp-3">
                  {source.content}
                </p>
                {source.metadata.chunkIndex !== undefined && (
                  <p className="text-xs text-gray-500 mt-2">
                    Chunk {source.metadata.chunkIndex + 1} of {source.metadata.chunkTotal || '?'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}