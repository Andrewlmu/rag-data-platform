# Testing Guide - Optimized Agent Implementation

## 🎯 Goal

Verify that the optimized agent implementation:
1. Works correctly (no breaking changes)
2. Improves performance (faster, cheaper, more reliable)
3. Eliminates plain text responses (100% tool usage)

---

## 📋 Prerequisites

Before testing, ensure:
```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Add your OPENAI_API_KEY to .env

# 3. Start ChromaDB (if not running)
./scripts/start-chromadb.sh

# 4. Upload test data
# Place CSV files in data/sample/ directory
```

---

## 🧪 Phase 1: Smoke Tests (15-20 minutes)

### **Test 1: Simple Lookup Query**

**Command:**
```bash
npm run dev
# Then in frontend: http://localhost:3000
```

**Query:**
```
What was the infant mortality rate in Nigeria in 2019?
```

**Expected behavior:**
```
✅ Loop 1: search_dataset_metadata → finds infantmortalityrate table
✅ Loop 2: query_structured_data → executes SQL query
✅ Loop 3: finish → returns answer with specific number
```

**Success criteria:**
- ✅ Completes in 3 loops
- ✅ Returns specific number (e.g., "75.2 per 1000")
- ✅ Cites source (infantmortalityrate table)
- ✅ No plain text clarifications
- ✅ Total time: 10-20 seconds

---

### **Test 2: Comparison Query**

**Query:**
```
Which countries have the highest infant mortality rates?
```

**Expected behavior:**
```
✅ Loop 1: search_dataset_metadata → finds table + schema
✅ Loop 2: ask_clarification OR query_structured_data directly
✅ Loop 3: query_structured_data → SELECT ... ORDER BY DESC LIMIT 10
✅ Loop 4: finish → returns top 10 countries with rates
```

**Success criteria:**
- ✅ Completes in 3-4 loops
- ✅ Returns 10+ countries with specific rates
- ✅ Ordered by rate (descending)
- ✅ No "Which year?" text response
- ✅ Total time: 15-25 seconds

---

### **Test 3: Trend Analysis**

**Query:**
```
Show maternal mortality trends across regions
```

**Expected behavior:**
```
✅ Loop 1: search_dataset_metadata → finds maternal mortality table
✅ Loop 2: query_structured_data → queries available data
✅ Loop 3: finish → returns trends with adaptation note if needed
```

**Success criteria:**
- ✅ Completes in 3-5 loops
- ✅ Returns data for available years/regions
- ✅ Includes note if data is at country level instead of regions
- ✅ Shows trends or time series if available
- ✅ Total time: 15-30 seconds

---

### **Test 4: Exploratory Query**

**Query:**
```
Compare health metrics across countries
```

**Expected behavior:**
```
✅ Loop 1: search_dataset_metadata → finds relevant tables
✅ Loop 2: ask_clarification OR direct query with defaults
✅ Loop 3: query_structured_data → gets data
✅ Loop 4: finish → returns comparison
```

**Success criteria:**
- ✅ Completes in 4-6 loops
- ✅ Makes reasonable assumptions (top 10 countries, recent years)
- ✅ Returns multiple entities for comparison
- ✅ No "Which countries?" text response
- ✅ Total time: 20-35 seconds

---

## 📊 Phase 2: Metric Collection (1-2 hours)

### **Setup Logging**

Create a test script to collect metrics:

```typescript
// test-metrics.ts
import { AgenticRAG } from './src/agents/agenticRAG';
import { VectorSearchService } from './src/services/vectorSearch';
import { DataProcessor } from './src/services/dataProcessor';

const queries = [
  "What was the infant mortality rate in Nigeria in 2019?",
  "Which countries have the highest infant mortality rates?",
  "Show maternal mortality trends across regions",
  "Compare health metrics across countries",
  "What is the average life expectancy?",
  // Add 15+ more test queries
];

async function runMetrics() {
  const vectorSearch = new VectorSearchService();
  await vectorSearch.initialize();

  const dataProcessor = new DataProcessor(null, vectorSearch);
  await dataProcessor.initialize();

  const agenticRAG = new AgenticRAG(vectorSearch, null, dataProcessor);
  await agenticRAG.initialize();

  const results = [];

  for (const query of queries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${query}`);
    console.log('='.repeat(60));

    const startTime = Date.now();
    const startTokens = getTokenCount(); // Implement this

    try {
      const result = await agenticRAG.query(query);
      const endTime = Date.now();
      const endTokens = getTokenCount();

      results.push({
        query,
        success: true,
        loopCount: result.reasoning.loopCount,
        toolsUsed: result.reasoning.toolsUsed,
        tokensUsed: endTokens - startTokens,
        latency: endTime - startTime,
        answerLength: result.answer.length,
        sourcesCount: result.sources.length
      });

      console.log('✅ SUCCESS');
      console.log(`   Loops: ${result.reasoning.loopCount}`);
      console.log(`   Tools: ${result.reasoning.toolsUsed.join(', ')}`);
      console.log(`   Time: ${endTime - startTime}ms`);

    } catch (error) {
      results.push({
        query,
        success: false,
        error: error.message
      });
      console.log('❌ FAILED:', error.message);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('METRICS SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const avgLoops = successful.reduce((sum, r) => sum + r.loopCount, 0) / successful.length;
  const avgLatency = successful.reduce((sum, r) => sum + r.latency, 0) / successful.length;
  const avgTokens = successful.reduce((sum, r) => sum + r.tokensUsed, 0) / successful.length;

  console.log(`Success rate: ${successful.length}/${results.length} (${(successful.length / results.length * 100).toFixed(1)}%)`);
  console.log(`Average loops: ${avgLoops.toFixed(1)}`);
  console.log(`Average latency: ${(avgLatency / 1000).toFixed(1)}s`);
  console.log(`Average tokens: ${avgTokens.toFixed(0)}`);

  // Save results to file
  fs.writeFileSync('test-metrics.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Metrics saved to test-metrics.json');
}

runMetrics();
```

**Run:**
```bash
npx tsx test-metrics.ts
```

---

### **Target Metrics**

Compare against baseline:

| Metric | Baseline | Target | Pass Criteria |
|--------|----------|--------|---------------|
| Success rate | 70-80% | ≥85% | ✅ if ≥85% |
| Avg loops | 8-10 | 4-6 | ✅ if ≤6 |
| Avg latency | 45-60s | 20-35s | ✅ if ≤35s |
| Avg tokens | ~5000 | ~2000 | ✅ if ≤2500 |
| Plain text responses | 20-30% | 0% | ✅ if 0% |
| Cost per query | $0.50 | $0.25 | ✅ if ≤$0.30 |

---

## 🔍 Phase 3: Edge Case Testing (30 minutes)

### **Edge Case 1: No Data Found**

**Query:**
```
Show data for the fictional country of Atlantis
```

**Expected:**
- ✅ Searches metadata
- ✅ Finds no results
- ✅ Falls back to vector_search OR returns "No data found for Atlantis"
- ✅ Does NOT loop infinitely

---

### **Edge Case 2: Ambiguous Query**

**Query:**
```
Show me trends
```

**Expected:**
- ✅ Calls ask_clarification OR makes assumptions
- ✅ Queries with reasonable defaults (recent years, top entities)
- ✅ Returns meaningful results
- ✅ No "Which trends?" text response

---

### **Edge Case 3: Invalid SQL**

Simulate by forcing a query with wrong column name:

**Expected:**
- ✅ Gets SQL error from DuckDB
- ✅ Retries with corrected SQL (using correct schema)
- ✅ Eventually succeeds OR returns clear error
- ✅ Doesn't loop more than 7-8 times

---

### **Edge Case 4: Complex Multi-Step**

**Query:**
```
Compare infant mortality rates between African and Asian countries, show only those above 50 per 1000, for years 2015-2019
```

**Expected:**
- ✅ Breaks down into multiple queries
- ✅ Applies filters correctly
- ✅ Returns filtered results
- ✅ Completes in 6-8 loops max

---

## 📈 Phase 4: Load Testing (Optional)

### **Concurrent Queries Test**

```bash
# Run 5 queries concurrently
npm run test:load
```

**Monitor:**
- Memory usage (should stay <2GB)
- Response times (should stay <60s)
- Error rates (should be <5%)
- ChromaDB connection stability

---

## 🐛 Debugging Tips

### **If agent gets stuck in loops:**

1. **Check logs for tool calls:**
   ```
   🧠 LLM Node (Loop X)
   🔧 LLM wants to call X tool(s): → tool_name(args)
   ```

2. **Look for patterns:**
   - Calling same tool repeatedly? → Tool description unclear
   - Calling wrong tools? → System prompt needs adjustment
   - Not calling finish? → Finish tool description unclear

3. **Inspect tool results:**
   ```
   ✅ Tool result: {found: true, count: 10, ...}
   ```
   - Empty results? → Data not indexed properly
   - Error messages? → Tool implementation issue

---

### **If plain text responses appear:**

This should be **impossible** with `tool_choice='required'`.

If you see plain text:
1. Verify `tool_choice='required'` is actually set in react-agent.ts:217
2. Check OpenAI API version (may need update)
3. Check if error was thrown (plain text in error message)

---

### **If SQL queries fail:**

1. **Check schema matching:**
   ```sql
   -- Wrong (will fail)
   SELECT Period, Location FROM table WHERE year = 2019

   -- Right (matches schema)
   SELECT Period, Location FROM table WHERE Period = 2019
   ```

2. **Look for column name issues:**
   - Schema shows "First Tooltip" → Must use quotes in SQL
   - Schema shows separate Quarter/Year → Use separate filters

3. **Check DuckDB logs:**
   ```
   ❌ query_structured_data error: column "year" does not exist
   ```

---

## ✅ Success Checklist

After all tests, verify:

- [ ] All 4 smoke tests pass
- [ ] Metrics show 40%+ improvement in tokens/latency
- [ ] Success rate ≥85%
- [ ] Average loop count ≤6
- [ ] Zero plain text responses (0/20 queries)
- [ ] Edge cases handled gracefully
- [ ] No infinite loops observed
- [ ] Tool usage looks reasonable (logs)

---

## 📝 Reporting Results

Create a summary report:

```markdown
# Test Results - [Date]

## Summary
- Queries tested: X
- Success rate: X%
- Avg loops: X
- Avg latency: Xs
- Avg tokens: X
- Cost per query: $X

## Improvements vs Baseline
- Latency: -X%
- Tokens: -X%
- Cost: -X%
- Loops: -X%
- Plain text: -100%

## Issues Found
1. [Issue description]
2. [Issue description]

## Recommendations
1. [Recommendation]
2. [Recommendation]
```

---

## 🚀 Next Actions

### **If tests pass:**
1. Deploy to production
2. Monitor for 1 week
3. Collect user feedback
4. Iterate on tool descriptions

### **If tests fail:**
1. Analyze failure patterns
2. Refine tool descriptions
3. Adjust system prompt if needed
4. Re-test with fixes

### **Phase 2 Optimizations:**
1. Add data persistence
2. Implement query caching
3. Add cost tracking
4. Consider GPT-4o-mini for simple queries

---

**Testing Status:** Ready to begin
**Estimated Time:** 2-3 hours for complete test suite
**Priority:** HIGH - Measure before optimizing further
