import { OpenAI } from 'openai';

export async function validateOpenAIKey(): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
    console.error('❌ Invalid OpenAI API key in .env file');
    return false;
  }

  try {
    const openai = new OpenAI({ apiKey });
    await openai.models.list();
    console.log('✅ OpenAI API key validated successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Failed to validate OpenAI API key:', error?.message);
    return false;
  }
}
