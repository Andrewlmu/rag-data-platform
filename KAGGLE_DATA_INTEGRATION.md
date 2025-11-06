# 📊 Kaggle Data Integration Guide for PE Analysis

## 🎯 Best Kaggle Datasets for PE Analysis (Ranked by Relevance)

### 1. 🏆 **S&P 500 Stocks (Daily Updated)** ⭐⭐⭐⭐⭐
```
URL: https://www.kaggle.com/datasets/andrewmvd/sp-500-stocks
Size: ~500MB
Update: December 2024 (LATEST!)
Content: Daily stock prices, volume, market cap for all S&P 500 companies
```

### 2. 💰 **Financial Performance of Companies from S&P500** ⭐⭐⭐⭐⭐
```
URL: https://www.kaggle.com/datasets/ilyaryabov/financial-performance-of-companies-from-sp500
Size: ~100MB
Update: March 2023
Content: 72 financial indicators including EBITDA, revenue, margins, debt ratios
Perfect for: PE financial analysis
```

### 3. 🏦 **Mergers and Acquisitions Dataset** ⭐⭐⭐⭐
```
URL: https://www.kaggle.com/datasets/shivamb/company-acquisitions-7-top-companies
Size: ~50MB
Update: 2021-2023
Content: M&A transactions, deal values, acquisition targets
```

### 4. 📈 **S&P 500 ESG and Stocks Data 2023-24** ⭐⭐⭐⭐
```
URL: https://www.kaggle.com/datasets/rikinzala/s-and-p-500-esg-and-stocks-data-2023-24
Size: ~200MB
Update: September 2024
Content: ESG scores + financial metrics (important for modern PE)
```

### 5. 🔧 **Technology Mergers & Acquisitions** ⭐⭐⭐
```
URL: https://www.kaggle.com/datasets/joebeachcapital/technology-mergers-and-acquisitions
Size: ~25MB
Update: August 2023
Content: Tech sector M&A deals from 36 tech giants
```

---

## 🚀 Step-by-Step: Download & Load Kaggle Data

### Step 1: Install Kaggle CLI
```bash
# Install Kaggle API
pip install kaggle

# Set up API credentials
# 1. Go to https://www.kaggle.com/account
# 2. Click "Create New API Token"
# 3. Save kaggle.json to ~/.kaggle/
mkdir -p ~/.kaggle
mv ~/Downloads/kaggle.json ~/.kaggle/
chmod 600 ~/.kaggle/kaggle.json
```

### Step 2: Download Datasets
```bash
# Create data directory
cd /Users/andymu/Desktop/poc
mkdir -p data/kaggle

# Download S&P 500 financial performance (BEST FOR PE)
kaggle datasets download -d ilyaryabov/financial-performance-of-companies-from-sp500 -p data/kaggle/

# Download daily S&P 500 stocks (MOST CURRENT)
kaggle datasets download -d andrewmvd/sp-500-stocks -p data/kaggle/

# Download M&A dataset
kaggle datasets download -d shivamb/company-acquisitions-7-top-companies -p data/kaggle/

# Unzip all datasets
cd data/kaggle
unzip -o "*.zip"
```

### Step 3: Create Data Loader Script
```typescript
// File: src/scripts/loadKaggleData.ts
import { parse } from 'csv-parse';
import * as fs from 'fs';
import axios from 'axios';

async function loadKaggleData() {
  const files = [
    'data/kaggle/sp500_financial_data.csv',
    'data/kaggle/sp500_stocks.csv',
    'data/kaggle/acquisitions.csv'
  ];

  for (const file of files) {
    console.log(`📁 Loading ${file}...`);

    const formData = new FormData();
    const fileStream = fs.createReadStream(file);
    formData.append('files', fileStream);

    const response = await axios.post(
      'http://localhost:8000/api/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    console.log(`✅ Loaded ${file}: ${response.data.chunks} chunks created`);
  }
}

// Run the loader
loadKaggleData().catch(console.error);
```

### Step 4: Run the Loader
```bash
# Execute the loader script
npx tsx src/scripts/loadKaggleData.ts
```

---

## 📈 What Each Dataset Provides for PE Analysis

### **S&P 500 Financial Performance (72 Indicators)**
Perfect for PE because it includes:
```
- Revenue (trailing 12 months)
- EBITDA and EBITDA margins
- Net income and profit margins
- Debt-to-equity ratios
- Return on equity (ROE)
- Return on assets (ROA)
- Free cash flow
- Working capital
- Enterprise value
- P/E ratios
- Book value per share
- Quick ratio / Current ratio
```

### **Daily S&P 500 Stock Data**
Valuable for:
```
- Market cap tracking
- Price volatility analysis
- Trading volume patterns
- 52-week highs/lows
- Sector performance comparison
- Market timing for exits
```

### **M&A Dataset**
Critical for:
```
- Deal multiples analysis
- Acquisition target profiles
- Industry consolidation trends
- Strategic buyer patterns
- Deal size distributions
- Success/failure patterns
```

---

## 🔍 Test Queries for Kaggle Data

### After Loading S&P 500 Financial Data:
```
1. "Which companies have EBITDA margins above 30%?"
2. "Show me companies with debt-to-equity ratios under 0.5"
3. "What's the average P/E ratio by sector?"
4. "Find companies with consistent revenue growth over 3 years"
5. "Identify companies with strong free cash flow generation"
```

### After Loading M&A Data:
```
1. "What's the average acquisition multiple in tech?"
2. "Show me all acquisitions above $1 billion"
3. "Which companies are the most active acquirers?"
4. "What are the typical deal sizes by sector?"
5. "Identify consolidation trends in healthcare"
```

### Cross-Dataset Analysis:
```
1. "Compare EBITDA margins of acquirers vs targets"
2. "Find undervalued companies based on P/E and growth"
3. "Which high-margin companies are potential acquisition targets?"
4. "Show correlation between debt levels and acquisition activity"
```

---

## 💪 Advanced: Load 1GB+ Dataset

### For Massive Data Testing:
```bash
# Download large financial dataset (1GB+)
kaggle datasets download -d camnugent/sandp500 -p data/kaggle/

# This contains:
# - 5 years of daily data for all S&P 500 stocks
# - ~2.5 million rows of data
# - Perfect for stress testing

# Process in chunks to avoid memory issues
python process_large_dataset.py
```

### Chunk Processing Script:
```python
import pandas as pd
import requests

def process_large_csv(filepath, chunk_size=10000):
    """Process large CSV in chunks"""

    for i, chunk in enumerate(pd.read_csv(filepath, chunksize=chunk_size)):
        print(f"Processing chunk {i+1}: {len(chunk)} rows")

        # Convert to JSON
        data = chunk.to_json(orient='records')

        # Send to API
        response = requests.post(
            'http://localhost:8000/api/upload',
            json={'data': data, 'chunk_id': i}
        )

        if response.status_code == 200:
            print(f"✅ Chunk {i+1} uploaded")
        else:
            print(f"❌ Chunk {i+1} failed")

# Process the large file
process_large_csv('data/kaggle/all_stocks_5yr.csv')
```

---

## 📊 Expected Results After Loading

### System Performance with Kaggle Data:
```
Dataset                    | Rows      | Load Time | Query Time
--------------------------|-----------|-----------|------------
S&P 500 Financials (72)   | 500       | 30 sec    | 15 sec
Daily Stock Data          | 125,000   | 2 min     | 20 sec
M&A Transactions          | 10,000    | 1 min     | 12 sec
Combined All              | 135,500   | 4 min     | 25 sec
Large Dataset (5yr)       | 2,500,000 | 15 min    | 30 sec
```

### Memory Usage:
```
Before Kaggle Data: ~200MB
After 500 companies: ~400MB
After 125K records: ~800MB
After 2.5M records: ~2GB
```

---

## 🎯 Specific PE Analysis You Can Do

### 1. **LBO Analysis**
```
Query: "Find companies with EBITDA > $100M, debt/equity < 2, and stable cash flows"
Result: List of potential LBO targets with metrics
```

### 2. **Portfolio Company Benchmarking**
```
Query: "Compare our portfolio companies' margins against industry medians"
Result: Comparative analysis with percentile rankings
```

### 3. **Exit Opportunity Identification**
```
Query: "Which sectors have the highest acquisition multiples?"
Result: Sector analysis with average EV/EBITDA multiples
```

### 4. **Risk Assessment**
```
Query: "Identify companies with deteriorating financial metrics"
Result: Companies with declining margins, increasing debt, or cash flow issues
```

### 5. **Value Creation Opportunities**
```
Query: "Find companies with below-average margins but strong revenue growth"
Result: Operational improvement candidates
```

---

## 🚨 Troubleshooting Kaggle Integration

### If Download Fails:
```bash
# Check Kaggle API credentials
ls -la ~/.kaggle/kaggle.json

# Test API connection
kaggle datasets list

# Manual download fallback
# Go to dataset page and click "Download"
```

### If Files Too Large:
```bash
# Split large CSV files
split -l 100000 large_file.csv chunk_

# Process each chunk separately
for file in chunk_*; do
  curl -X POST http://localhost:8000/api/upload \
    -F "files=@$file"
done
```

### If Memory Issues:
```javascript
// Increase Node.js memory limit
node --max-old-space-size=4096 server.js

// Or in package.json:
"scripts": {
  "dev:backend": "node --max-old-space-size=4096 -r tsx/register src/backend/server.ts"
}
```

---

## ✅ Verification Checklist

After loading Kaggle data, verify:

- [ ] Can query for companies by EBITDA margin
- [ ] Can filter by debt-to-equity ratio
- [ ] Can analyze sector performance
- [ ] Can identify M&A patterns
- [ ] Can benchmark financial metrics
- [ ] Can find acquisition targets
- [ ] Can assess portfolio risk
- [ ] Can track market valuations
- [ ] Response time under 30 seconds
- [ ] System memory under 2GB

---

**Pro Tip**: Start with the S&P 500 Financial Performance dataset (72 indicators) - it's the most PE-relevant and manageable size for testing!