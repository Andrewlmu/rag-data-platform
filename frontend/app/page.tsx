'use client';

import { useState, useEffect } from 'react';
import { Upload, Search, FileText, BarChart3, Loader2, CheckCircle } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import QueryInterface from '@/components/QueryInterface';
import DataStats from '@/components/DataStats';
import ResultsDisplay from '@/components/ResultsDisplay';
import { useSocket } from '@/lib/socket';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'upload' | 'query' | 'stats'>('query');
  const [isLoading, setIsLoading] = useState(false);
  const socket = useSocket();

  // Fetch data statistics
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await axios.get('/api/stats');
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('upload:complete', () => {
      refetchStats();
    });

    socket.on('sample-data:loaded', () => {
      refetchStats();
    });

    return () => {
      socket.off('upload:complete');
      socket.off('sample-data:loaded');
    };
  }, [socket, refetchStats]);

  const loadSampleData = async () => {
    setIsLoading(true);
    try {
      await axios.post('/api/load-sample-data');
    } catch (error) {
      console.error('Failed to load sample data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          PE Analysis Platform
        </h1>
        <p className="text-gray-600">
          Powered by GPT-5 • Full TypeScript Async Architecture
        </p>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="text-sm text-gray-600">Total Files</div>
            <div className="text-2xl font-bold">{stats.totalFiles || 0}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Vector Embeddings</div>
            <div className="text-2xl font-bold">{stats.vectorEmbeddings || 0}</div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Companies</div>
            <div className="text-2xl font-bold">
              {stats.structuredRecords?.companies || 0}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-600">Transactions</div>
            <div className="text-2xl font-bold">
              {stats.structuredRecords?.transactions || 0}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mb-8 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('query')}
            className={`pb-4 px-1 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'query'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Search size={20} />
            <span className="font-medium">Query Data</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-4 px-1 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Upload size={20} />
            <span className="font-medium">Upload Documents</span>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`pb-4 px-1 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 size={20} />
            <span className="font-medium">Analytics</span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'query' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">
                Query Your PE Data
              </h2>
              <QueryInterface />
            </div>
            {!stats?.totalFiles && (
              <div className="card bg-blue-50 border-blue-200">
                <p className="text-blue-900 mb-4">
                  No data loaded yet. Would you like to load sample data?
                </p>
                <button
                  onClick={loadSampleData}
                  disabled={isLoading}
                  className="btn-primary flex items-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Loading Sample Data...</span>
                    </>
                  ) : (
                    <>
                      <FileText size={16} />
                      <span>Load Sample Data</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">
              Upload Documents
            </h2>
            <FileUpload onUploadComplete={refetchStats} />
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">
              Data Analytics
            </h2>
            <DataStats stats={stats} />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
        <p>PE Analysis POC • GPT-5 Model • November 2025</p>
        <p className="mt-2">
          Full async TypeScript implementation with real-time updates
        </p>
      </footer>
    </div>
  );
}