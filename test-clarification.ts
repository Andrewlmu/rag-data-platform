/**
 * Test script for ask_clarification tool
 *
 * This demonstrates how the GPT-5 powered clarification resolver works
 */

import OpenAI from 'openai';
import { createAskClarificationTool } from './src/agents/tools/ask-clarification';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testClarificationResolver() {
  console.log('\n🧪 Testing Ask Clarification Tool\n');
  console.log('='.repeat(60));

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Create the tool
  const clarificationTool = createAskClarificationTool(openai);

  // Test Case 1: Simple uncertainty about year and entities
  console.log('\n📝 Test Case 1: Infant Mortality Rates (Simple)');
  console.log('-'.repeat(60));

  const result1 = await clarificationTool.function({
    uncertainties: "Which year should I use? Which countries to show?",
    context: `User asked: "Which countries have the highest infant mortality rates?"

I found the infantmortalityrate table with:
- Period column (INTEGER): ranges from 2000 to 2019
- Location column (TEXT): 195 different countries
- First Tooltip column (TEXT): contains the rate value
- Dim1 column (TEXT): 'Both sexes', 'Male', 'Female'

The user didn't specify which year or how many countries to show.`
  });

  console.log('\n✅ Resolution:');
  console.log(JSON.stringify(result1, null, 2));

  // Test Case 2: Complex trend analysis
  console.log('\n\n📝 Test Case 2: Climate Trends (Complex)');
  console.log('-'.repeat(60));

  const result2 = await clarificationTool.function({
    uncertainties: "Time period for trends? Which regions? Which metric (Temperature, Rainfall, or CO2)?",
    context: `User asked: "Show me climate trends across regions"

I found the climate_data table with:
- Region column (TEXT): 50 different regions
- Year column (INTEGER): ranges from 1950 to 2023
- Temperature column (REAL): average temperature
- Rainfall column (REAL): annual rainfall
- CO2 column (REAL): CO2 levels

The user wants "trends" which implies time series, and "across regions" means multiple regions, but didn't specify which metric or time period.`
  });

  console.log('\n✅ Resolution:');
  console.log(JSON.stringify(result2, null, 2));

  // Test Case 3: Metric selection
  console.log('\n\n📝 Test Case 3: Financial Analysis (Metric Selection)');
  console.log('-'.repeat(60));

  const result3 = await clarificationTool.function({
    uncertainties: "Which metric should I analyze? Revenue, EBITDA, or Net Income?",
    context: `User asked: "Show me the performance trends for tech companies"

I found the financials table with:
- Company column (TEXT): 50 tech companies
- Quarter column (TEXT): Q1, Q2, Q3, Q4
- Year column (INTEGER): 2020-2024
- Revenue column (REAL)
- EBITDA column (REAL)
- NetIncome column (REAL)

"Performance" is ambiguous - could be any of the financial metrics.`
  });

  console.log('\n✅ Resolution:');
  console.log(JSON.stringify(result3, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!\n');
}

// Run tests
testClarificationResolver().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
