import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { encrypt } from '@/lib/secrets';
import { ObjectId } from 'mongodb';
import axios from 'axios';

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { githubToken } = await req.json();
    if (!githubToken) {
      return NextResponse.json({ error: 'GitHub Personal Access Token is required' }, { status: 400 });
    }

    // 1. Verify the token by calling GitHub API
    let githubUser: string;
    try {
      const res = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'BucketDev-App'
        }
      });
      githubUser = res.data.login;
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        error: `GitHub token verification failed: ${e.response?.data?.message || e.message || 'Invalid token'}`
      }, { status: 400 });
    }

    // 2. Encrypt the token and save to user record
    const encryptedToken = encrypt(githubToken);
    const { db } = await connectToDatabase();

    await db.collection('dev_users').updateOne(
      { _id: new ObjectId(session.userId) },
      {
        $set: {
          githubToken: encryptedToken,
          githubUsername: githubUser,
          githubLinkedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      githubUsername: githubUser,
      message: `GitHub account @${githubUser} linked successfully!`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
