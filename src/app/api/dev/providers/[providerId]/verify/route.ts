import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { encrypt } from '@/lib/secrets';
import axios from 'axios';

export async function POST(req: NextRequest, { params }: { params: Promise<{ providerId: string }> | { providerId: string } }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey } = await req.json();
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // Safely resolve params which may be a Promise in Next.js 15
    const resolvedParams = await params;
    const { providerId } = resolvedParams;

    if (!['openai', 'gemini'].includes(providerId)) {
      return NextResponse.json({ error: 'Invalid provider ID. Must be openai or gemini.' }, { status: 400 });
    }

    // 1. Verify connectivity against active model endpoints
    let isValid = false;
    try {
      if (providerId === 'openai') {
        const testRes = await axios.get('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (testRes.status === 200) isValid = true;
      } else if (providerId === 'gemini') {
        const testRes = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (testRes.status === 200) isValid = true;
      }
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        error: `Key validation failed: ${e.response?.data?.error?.message || e.message || 'Unable to connect to provider API.'}`
      }, { status: 400 });
    }

    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Key verification failed' }, { status: 400 });
    }

    // 2. Encrypt key
    const encryptedKey = encrypt(apiKey);
    const { db } = await connectToDatabase();

    // 3. Set all other keys of this provider to inactive
    await db.collection('dev_providers').updateMany(
      { userId: session.userId, provider: providerId },
      { $set: { isActive: false } }
    );

    // 4. Save/Update key
    await db.collection('dev_providers').insertOne({
      userId: session.userId,
      provider: providerId,
      apiKeyEncrypted: encryptedKey,
      isActive: true,
      createdAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: `${providerId === 'openai' ? 'OpenAI' : 'Gemini'} key verified and saved successfully.`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
