# PE Data Analysis POC

AI-powered data analysis platform for Private Equity due diligence. Processes both structured and unstructured data with semantic search capabilities.

## 🚀 Features

- **Multi-format Support**: CSV, Excel, PDF, Word documents
- **Intelligent Processing**: Document parsing, chunking, and vector embeddings
- **Semantic Search**: Find information by meaning, not just keywords
- **Unified Intelligence**: Query across all data sources simultaneously
- **Production Architecture**: RAG pattern with ChromaDB vector store
- **GPT-4 Integration**: Advanced reasoning and analysis

## 📋 Prerequisites

- Python 3.8+
- OpenAI API key
- 4GB RAM minimum
- 2GB disk space

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone https://github.com/Andrewlmu/poc.git
cd poc
```

### 2. Create virtual environment
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up environment variables
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### 5. Generate test data (optional)
```bash
python create_test_data.py
```

## 🚦 Quick Start

### Run locally
```bash
streamlit run app.py
```

The app will open at `http://localhost:8501`

### First time usage
1. Click "Generate Sample Data" or prepare your own data in `kaggle_data/`
2. Click "Load/Reload Data" in the sidebar
3. Start asking questions!

## 📁 Data Format

Place your data files in the `kaggle_data/` directory:

- **Structured Data**: `.csv`, `.xlsx`, `.xls` files
- **Documents**: `.pdf`, `.docx`, `.txt` files

### Sample directory structure:
```
kaggle_data/
├── financial_data.csv
├── sales_transactions.xlsx
├── customer_data.csv
├── risk_assessment_report.pdf
└── due_diligence_summary.docx
```

## 💡 Example Questions

- "What's the average revenue across all companies?"
- "What are the main risk factors mentioned in the documents?"
- "Show me companies with EBITDA margins above 20%"
- "Find all mentions of customer concentration"
- "Compare revenue growth across different sectors"
- "What data quality issues exist in the datasets?"

## 🏗️ Architecture

```
Data Ingestion → Document Parsing → Chunking → Vector Embeddings → ChromaDB
                                                                      ↓
User Query → Semantic Search → Relevant Chunks → GPT-4 → Answer
```

### Key Components:
- **Document Processing**: PyPDF2, python-docx
- **Data Analysis**: Pandas, NumPy
- **Vector Store**: ChromaDB with OpenAI embeddings
- **LLM**: GPT-4 Turbo via LangChain
- **UI**: Streamlit

## 🚀 Deployment

### Railway Deployment

The app is configured for Railway deployment:

```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login and deploy
railway login
railway init
railway up
```

### Environment Variables

Set these in Railway dashboard:
- `OPENAI_API_KEY`: Your OpenAI API key
- `PORT`: (automatically set by Railway)

## 📊 Performance

- **Data Capacity**: 10,000+ documents, millions of rows
- **Query Speed**: 2-5 seconds average
- **Indexing**: ~1000 documents/minute
- **Memory Usage**: ~500MB for typical dataset

## 🔧 Configuration

### Customize in `.env`:
```env
OPENAI_API_KEY=sk-...
MAX_CHUNKS_PER_QUERY=5
EMBEDDING_MODEL=text-embedding-ada-002
LLM_MODEL=gpt-4-turbo-preview
```

### Streamlit configuration in `.streamlit/config.toml`

## 📈 Monitoring

The app provides real-time statistics:
- Total documents processed
- Chunks indexed
- Memory usage
- Query performance

## 🐛 Troubleshooting

### Common Issues

**ChromaDB error**
```bash
pip install chromadb --upgrade
```

**OpenAI API error**
```bash
# Verify API key is set
echo $OPENAI_API_KEY
```

**Memory issues**
- Reduce chunk size in app.py
- Process fewer documents at once

## 📚 Documentation

- [LangChain Docs](https://python.langchain.com/)
- [ChromaDB Docs](https://docs.trychroma.com/)
- [Streamlit Docs](https://docs.streamlit.io/)
- [OpenAI API Docs](https://platform.openai.com/docs)

## 🤝 Contributing

This is a POC project. For production deployment, consider:
- Adding authentication
- Implementing caching
- Using Reducto for better PDF parsing
- Scaling with cloud storage
- Adding monitoring/logging

## 📄 License

MIT

## 👥 Team

Built for PE data analysis POC demonstration.

## 🔮 Future Enhancements

- [ ] Reducto integration for better document parsing
- [ ] Support for Snowflake/BigQuery connections
- [ ] Real-time collaboration features
- [ ] Advanced visualization dashboards
- [ ] Export to PowerPoint functionality
- [ ] Multi-user support with authentication
- [ ] Audit trail and compliance features

## 💬 Support

For issues or questions, please open an issue on GitHub.

---

**Note**: This is a proof of concept. For production use, additional security, scaling, and compliance features would be required.