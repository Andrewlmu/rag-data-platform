# 🧪 Complete Testing Guide: PE Analysis Platform

## 🎯 Step-by-Step Testing Instructions

### Step 1: Open the Platform
```
1. Open Chrome/Safari/Firefox
2. Navigate to: http://localhost:3000
3. You should see:
   - Header: "PE Analysis Platform"
   - Subtitle: "Powered by GPT-5 • Full TypeScript Async Architecture"
   - Three tabs: Query Data | Upload Documents | Analytics
```

### Step 2: Load Sample Data (First Time)
```
What you see:
- Blue info box: "No data loaded yet. Would you like to load sample data?"
- Button: "Load Sample Data"

Action:
1. Click "Load Sample Data" button
2. Wait 10-15 seconds
3. The blue box should disappear
4. Stats should appear at top showing document counts
```

### Step 3: Test Basic Query
```
What to do:
1. In the text area, type: "What are the main risk factors?"
2. Click the Send button (arrow icon)

What you should see:
- Loading spinner with "Processing with GPT-5..."
- After 10-20 seconds, a detailed answer about PE risk factors
- Answer will include: Market Risk, Liquidity Risk, Regulatory Risk, etc.
- Sources section showing which documents were referenced
- Confidence score and processing time
```

### Step 4: Test Sample Queries
```
Click each sample query button and observe results:

1. "Which companies have EBITDA margins above 20%?"
   - Should list specific companies from sample data
   - Shows financial metrics

2. "Find customer concentration issues"
   - Identifies companies with >30% customer concentration
   - Lists specific company IDs

3. "What data quality issues exist?"
   - Shows missing values
   - Identifies inconsistencies
   - Provides recommendations

4. "Show revenue growth trends by sector"
   - Analyzes sector performance
   - Shows growth patterns
```

### Step 5: Test Document Upload
```
1. Click "Upload Documents" tab
2. Drag and drop a PDF or Excel file
   OR click to select files
3. Click "Upload All"
4. Watch progress indicators
5. Should see green checkmarks when complete
```

### Step 6: Test Analytics Tab
```
1. Click "Analytics" tab
2. You should see:
   - Overview cards with metrics
   - Pie chart of document types
   - Bar chart of structured records
   - Data quality indicators
```

---

## 📊 What You Should See (Screenshots)

### Main Query Interface
```
┌─────────────────────────────────────────┐
│  PE Analysis Platform                   │
│  Powered by GPT-5                       │
├─────────────────────────────────────────┤
│  [Query Data] [Upload] [Analytics]      │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │ Ask anything about PE data...   │    │
│  │                                  │    │
│  └─────────────────────────────────┘    │
│                                          │
│  [Sample Query 1] [Sample Query 2] ...  │
└─────────────────────────────────────────┘
```

### After Loading Data
```
Stats Bar:
┌──────┬──────┬──────┬──────┐
│ Docs │Chunks│ Comp │Trans │
│  5   │ 1034 │ 500  │10000 │
└──────┴──────┴──────┴──────┘
```

### Query Results
```
┌─────────────────────────────────────────┐
│ ✨ Answer                                │
├─────────────────────────────────────────┤
│ Based on the analysis, the main risk    │
│ factors include:                        │
│                                          │
│ 1. Market Risk                          │
│    - Economic downturns                 │
│    - Industry volatility                │
│                                          │
│ 2. Liquidity Risk                       │
│    - Exit challenges                    │
│    - Capital calls                      │
│                                          │
│ Confidence: 85% | Time: 16.3s | 5 srcs  │
└─────────────────────────────────────────┘
```

---

## 🔥 Advanced Testing with Real Data

### Test Query Performance
```bash
# Measure response time
time curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Analyze portfolio company performance"}'
```

### Test Concurrent Queries
```bash
# Run 3 queries simultaneously
curl -X POST http://localhost:8000/api/query -d '{"query": "Q1"}' &
curl -X POST http://localhost:8000/api/query -d '{"query": "Q2"}' &
curl -X POST http://localhost:8000/api/query -d '{"query": "Q3"}' &
```

### Test Large File Upload
```bash
# Upload a large Excel file
curl -X POST http://localhost:8000/api/upload \
  -F "files=@large_dataset.xlsx"
```

### Monitor WebSocket Events
```javascript
// Open browser console and paste:
const socket = io('http://localhost:8000');
socket.on('upload:progress', (data) => console.log('Progress:', data));
socket.on('query:complete', (data) => console.log('Query done:', data));
```

---

## 🚨 Common Issues & Solutions

### If Nothing Loads:
```bash
# Check backend is running
curl http://localhost:8000/health

# Check frontend is running
curl http://localhost:3000

# Restart if needed
npx tsx src/backend/server.ts
cd frontend && npm run dev
```

### If Queries Timeout:
```
- Normal query time: 10-20 seconds
- Complex queries: up to 30 seconds
- If longer, check OpenAI API status
```

### If Upload Fails:
```
- Max file size: 100MB
- Supported: PDF, Excel, Word, CSV, TXT
- Check file isn't corrupted
```

---

## 📈 Expected Performance Metrics

| Metric | Expected Value | Your Result |
|--------|---------------|-------------|
| Query Response | 10-20 sec | _________ |
| Document Upload | 2-5 sec/file | _________ |
| Search Accuracy | 80-90% | _________ |
| Concurrent Users | 10-20 | _________ |
| Memory Usage | <500MB | _________ |

---

## 🎮 Interactive Testing Checklist

- [ ] Platform loads at http://localhost:3000
- [ ] Sample data loads successfully
- [ ] Basic query returns answer
- [ ] All 5 sample queries work
- [ ] File upload accepts PDF
- [ ] File upload accepts Excel
- [ ] Analytics charts display
- [ ] WebSocket shows real-time updates
- [ ] Multiple queries can run simultaneously
- [ ] System handles errors gracefully

---

## 💡 Pro Testing Tips

1. **Best Test Queries for PE Data:**
   - "What's the average EBITDA margin across portfolio?"
   - "Identify underperforming companies"
   - "Show debt-to-equity ratios above 2.0"
   - "Find companies with negative cash flow"
   - "List recent acquisitions and their multiples"

2. **Stress Testing:**
   - Upload 10 files simultaneously
   - Run 5 queries in parallel
   - Upload a 50MB Excel file
   - Query with 500+ word questions

3. **Data Quality Testing:**
   - Upload file with missing data
   - Upload corrupted Excel
   - Query for non-existent data
   - Test with special characters

---

## 📊 Sample Test Results You Should See

### Query: "What are the main risk factors?"
```
✅ Returns 8 categories of risk
✅ 3000+ character response
✅ Processing time: 15-20 seconds
✅ Confidence: 85-95%
```

### Query: "Which companies have EBITDA > 20%?"
```
✅ Lists 50-100 companies
✅ Shows actual percentages
✅ Processing time: 10-15 seconds
✅ Includes company IDs
```

### Upload: 10MB Excel File
```
✅ Upload progress bar
✅ Completion in 5-10 seconds
✅ Chunks created: 100-200
✅ Green success checkmark
```