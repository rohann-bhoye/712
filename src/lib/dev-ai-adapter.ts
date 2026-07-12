import { connectToDatabase } from './mongodb';
import { decrypt } from './secrets';
import axios from 'axios';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function getDecryptedProviderKey(userId: string): Promise<{ provider: string; apiKey: string }> {
  const { db } = await connectToDatabase();
  const providerDoc = await db.collection('dev_providers').findOne({ userId, isActive: true });
  
  if (providerDoc) {
    const decryptedKey = decrypt(providerDoc.apiKeyEncrypted);
    return { provider: providerDoc.provider, apiKey: decryptedKey };
  }
  
  if (process.env.GEMINI_API_KEY) {
    return { provider: 'gemini', apiKey: process.env.GEMINI_API_KEY };
  }
  
  throw new Error('No active AI provider key configured. Please add one in settings.');
}

export async function getAIResponse(userId: string, messages: Message[]): Promise<string> {
  const { provider, apiKey } = await getDecryptedProviderKey(userId);

  if (provider === 'openai') {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: messages,
        temperature: 0.2,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.choices[0].message.content || '';
  } else if (provider === 'gemini') {
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        };
      });
    
    const systemMsg = messages.find(m => m.role === 'system');
    
    const requestData: any = { contents };
    if (systemMsg) {
      requestData.systemInstruction = {
        parts: [{ text: systemMsg.content }]
      };
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      requestData,
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    return response.data.candidates[0].content.parts[0].text || '';
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}
