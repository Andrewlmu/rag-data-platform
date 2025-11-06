#!/bin/bash

# PE Data Analysis POC - Setup Script
# This script sets up the complete POC environment

echo "🚀 PE Data Analysis POC Setup"
echo "============================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

print_status "Python 3 found: $(python3 --version)"

# Create virtual environment
print_status "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
print_status "Installing dependencies..."
pip install -r requirements.txt

# Create .streamlit directory
print_status "Creating Streamlit config directory..."
mkdir -p .streamlit
cp streamlit_config.toml .streamlit/config.toml

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating .env file from template..."
    cp .env.example .env
    print_warning "Please edit .env and add your OpenAI API key!"
    echo ""
    echo "Edit .env file and add your OpenAI API key:"
    echo "  OPENAI_API_KEY=sk-..."
    echo ""
fi

# Create kaggle_data directory
print_status "Creating data directory..."
mkdir -p kaggle_data

# Ask if user wants to generate test data
echo ""
read -p "Generate test data? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Generating test data..."
    python create_test_data.py
fi

# Create ChromaDB directory
mkdir -p chroma_db

# Final instructions
echo ""
echo "======================================"
echo "✅ Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your OpenAI API key"
echo "2. Run the application:"
echo "   source venv/bin/activate"
echo "   streamlit run app.py"
echo ""
echo "The app will open at http://localhost:8501"
echo ""
print_warning "Remember to activate the virtual environment before running!"
echo "   source venv/bin/activate"
echo ""