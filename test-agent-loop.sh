#!/bin/bash

echo "🧪 Testing Agentic RAG - ReAct Loop Verification"
echo "=================================================="
echo ""

# Test Query 1: Specific information that requires vector search
echo "Test 1: Specific deal information (requires vector search)"
echo "-----------------------------------------------------------"
echo "Query: 'What is the projected IRR for the ACME Manufacturing deal?'"
echo ""

curl -s -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the projected IRR for the ACME Manufacturing deal?"}' \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"Answer: {data.get('answer', '')}\"); print(f\"Loops: {data.get('reasoning', {}).get('loopCount', 0)}\"); print(f\"Tools: {', '.join(data.get('reasoning', {}).get('toolsUsed', []))}\"); print(f\"Processing time: {data.get('processingTime', 0)}ms\")"

echo ""
echo "=================================================="
echo ""

# Test Query 2: Multi-step reasoning required
echo "Test 2: Complex analysis (requires multiple reasoning steps)"
echo "------------------------------------------------------------"
echo "Query: 'Compare the EBITDA margins between ACME Manufacturing and Beta Technologies. Which has better profitability?'"
echo ""

curl -s -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Compare the EBITDA margins between ACME Manufacturing and Beta Technologies. Which has better profitability?"}' \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"Answer: {data.get('answer', '')[:200]}...\"); print(f\"Loops: {data.get('reasoning', {}).get('loopCount', 0)}\"); print(f\"Tools: {', '.join(data.get('reasoning', {}).get('toolsUsed', []))}\"); print(f\"Processing time: {data.get('processingTime', 0)}ms\")"

echo ""
echo "=================================================="
echo ""

# Test Query 3: Information from specific document
echo "Test 3: Specific metrics (from portfolio update)"
echo "------------------------------------------------"
echo "Query: 'What is Gamma Healthcare Services current unrealized MOIC?'"
echo ""

curl -s -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Gamma Healthcare Services current unrealized MOIC?"}' \
  | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"Answer: {data.get('answer', '')}\"); print(f\"Loops: {data.get('reasoning', {}).get('loopCount', 0)}\"); print(f\"Tools: {', '.join(data.get('reasoning', {}).get('toolsUsed', []))}\"); print(f\"Processing time: {data.get('processingTime', 0)}ms\")"

echo ""
echo "=================================================="
echo "✅ Test sequence complete"
echo "=================================================="
