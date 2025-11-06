'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  message?: string;
}

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      status: 'pending' as const,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    // Update all pending files to uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'pending' ? { ...f, status: 'uploading' } : f
      )
    );

    const formData = new FormData();
    pendingFiles.forEach((uploadedFile) => {
      formData.append('files', uploadedFile.file);
    });

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          console.log('Upload progress:', progress);
        },
      });

      // Mark files as successful
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading'
            ? { ...f, status: 'success', message: 'Uploaded successfully' }
            : f
        )
      );

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Upload error:', error);
      // Mark files as error
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading'
            ? { ...f, status: 'error', message: 'Upload failed' }
            : f
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-4 text-gray-400" size={48} />
        <p className="text-gray-700 font-medium mb-2">
          {isDragActive
            ? 'Drop files here...'
            : 'Drag & drop files here, or click to select'}
        </p>
        <p className="text-sm text-gray-500">
          Supported: PDF, Excel, Word, CSV, TXT
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-gray-900">
              Files ({files.length})
            </h3>
            <button
              onClick={uploadFiles}
              disabled={isUploading || files.every((f) => f.status !== 'pending')}
              className="btn-primary flex items-center space-x-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Upload All</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-2">
            {files.map((uploadedFile, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
              >
                <div className="flex items-center space-x-3">
                  <File className="text-gray-400" size={20} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {uploadedFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadedFile.file.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {uploadedFile.status === 'pending' && (
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                  {uploadedFile.status === 'uploading' && (
                    <Loader2 className="animate-spin text-primary-600" size={16} />
                  )}
                  {uploadedFile.status === 'success' && (
                    <CheckCircle className="text-green-600" size={16} />
                  )}
                  {uploadedFile.status === 'error' && (
                    <AlertCircle className="text-red-600" size={16} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}