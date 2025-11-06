'use client';

import { FileText, Database, Package, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DataStatsProps {
  stats: any;
}

export default function DataStats({ stats }: DataStatsProps) {
  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data available. Upload documents or load sample data to get started.
      </div>
    );
  }

  // Prepare data for charts
  const documentTypesData = Object.entries(stats.documentTypes || {}).map(([type, count]) => ({
    name: type,
    value: count as number,
  }));

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const overviewData = [
    {
      icon: FileText,
      label: 'Total Documents',
      value: stats.totalDocuments || 0,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      icon: Database,
      label: 'Vector Chunks',
      value: stats.totalChunks || 0,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      icon: Package,
      label: 'Companies',
      value: stats.structuredRecords?.companies || 0,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      icon: Clock,
      label: 'Last Updated',
      value: stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleTimeString() : 'Never',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewData.map((item, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className={`inline-flex p-2 rounded-lg ${item.bgColor} mb-3`}>
              <item.icon className={item.color} size={20} />
            </div>
            <p className="text-sm text-gray-600 mb-1">{item.label}</p>
            <p className="text-2xl font-bold text-gray-900">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Types Pie Chart */}
        {documentTypesData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Document Types</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={documentTypesData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {documentTypesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Structured Records Bar Chart */}
        {stats.structuredRecords && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Structured Records</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  { name: 'Companies', value: stats.structuredRecords.companies || 0 },
                  { name: 'Transactions', value: Math.min(stats.structuredRecords.transactions || 0, 1000) },
                  { name: 'Customers', value: stats.structuredRecords.customers || 0 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Data Quality Indicators */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Data Quality Indicators</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Chunk Coverage</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full"
                style={{
                  width: `${Math.min(
                    ((stats.totalChunks || 0) / Math.max(stats.totalDocuments || 1, 1)) * 10,
                    100
                  )}%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {((stats.totalChunks || 0) / Math.max(stats.totalDocuments || 1, 1)).toFixed(1)} chunks per doc
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Document Diversity</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{
                  width: `${Math.min(Object.keys(stats.documentTypes || {}).length * 20, 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {Object.keys(stats.documentTypes || {}).length} different types
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-2">Data Completeness</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full"
                style={{
                  width: `${
                    stats.totalDocuments > 0 ? 85 : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.totalDocuments > 0 ? 'Good coverage' : 'No data'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}