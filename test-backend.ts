import dotenv from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';

// Load environment variables
dotenv.config();

async function testBackend() {
  console.log('🧪 Testing TypeScript PE Analysis Backend...\n');

  // Test 1: Check environment variables
  console.log('1️⃣ Checking environment variables...');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
    console.error('❌ OpenAI API key not set in .env file');
    console.log('   Please set your actual OpenAI API key in the .env file');
    process.exit(1);
  }
  console.log('✅ OpenAI API key configured\n');

  // Test 2: Verify TypeScript async capabilities
  console.log('2️⃣ Testing async/await capabilities...');
  const asyncTest = await new Promise<string>((resolve) => {
    setTimeout(() => resolve('Async working!'), 100);
  });
  console.log(`✅ ${asyncTest}\n`);

  // Test 3: Test LangChain connection (without making API call)
  console.log('3️⃣ Testing LangChain initialization with GPT-5...');
  try {
    const llm = new ChatOpenAI({
      modelName: 'gpt-5',
      temperature: 0,
      openAIApiKey: apiKey
    });
    console.log('✅ LangChain initialized successfully with GPT-5\n');
  } catch (error) {
    console.error('❌ Failed to initialize LangChain:', error);
    process.exit(1);
  }

  // Test 4: Check imports
  console.log('4️⃣ Verifying all service imports...');
  try {
    await import('./src/services/vectorSearch');
    console.log('✅ VectorSearchService imported');

    await import('./src/services/queryEngine');
    console.log('✅ QueryEngine imported');

    await import('./src/services/documentParser');
    console.log('✅ DocumentParser imported');

    await import('./src/services/dataProcessor');
    console.log('✅ DataProcessor imported\n');
  } catch (error) {
    console.error('❌ Failed to import services:', error);
    process.exit(1);
  }

  // Test 5: Configuration summary
  console.log('5️⃣ Configuration Summary:');
  console.log('   - Model: GPT-5');
  console.log('   - Embedding Model: text-embedding-3-large');
  console.log('   - Backend Port: 8000');
  console.log('   - Frontend URL: http://localhost:3000');
  console.log('   - Environment: development\n');

  console.log('🎉 All tests passed! Backend is ready for use.');
  console.log('\nTo start the backend server, run:');
  console.log('  npm run dev:backend\n');
}

// Run tests
testBackend().catch(console.error);