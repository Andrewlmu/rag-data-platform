#!/bin/bash

echo "🚀 Starting ChromaDB..."

if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker first."
  echo "Alternative: Install ChromaDB locally with: pip install chromadb"
  exit 1
fi

docker stop chromadb 2>/dev/null
docker rm chromadb 2>/dev/null

docker run -d \
  --name chromadb \
  -p 8000:8000 \
  -v ./chroma_data:/chroma/chroma \
  -e ALLOW_RESET=TRUE \
  -e IS_PERSISTENT=TRUE \
  chromadb/chroma:latest

echo "⏳ Waiting for ChromaDB to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null; then
    echo "✅ ChromaDB is ready!"
    exit 0
  fi
  sleep 1
done

echo "❌ ChromaDB failed to start"
exit 1