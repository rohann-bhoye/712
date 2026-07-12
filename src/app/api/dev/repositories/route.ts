import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { getGithubHeaders } from '@/lib/dev-github';
import axios from 'axios';

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');

    const { db } = await connectToDatabase();
    const user = await db.collection('dev_users').findOne({ _id: new ObjectId(session.userId) });
    const token = user?.githubToken || process.env.GITHUB_TOKEN || '';

    if (!token) {
      return NextResponse.json({ error: 'No GitHub credentials found. Please link your GitHub account.' }, { status: 400 });
    }

    const headers = await getGithubHeaders(token);

    if (owner && repo) {
      // 1. Fetch branches for the repository
      try {
        const branchesRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/branches`, { headers });
        const branches = branchesRes.data.map((b: any) => ({
          name: b.name,
          protected: b.protected
        }));
        return NextResponse.json({ success: true, branches });
      } catch (e: any) {
        return NextResponse.json({
          error: `Failed to fetch branches from GitHub: ${e.response?.data?.message || e.message}`
        }, { status: e.response?.status || 500 });
      }
    } else {
      // 2. Fetch all repositories the token has access to
      try {
        const reposRes = await axios.get('https://api.github.com/user/repos?per_page=100&sort=updated', { headers });
        const repos = reposRes.data.map((r: any) => ({
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          owner: r.owner.login,
          private: r.private,
          description: r.description,
          defaultBranch: r.default_branch
        }));
        return NextResponse.json({ success: true, repositories: repos });
      } catch (e: any) {
        // Fallback: if user is using personal access token, we can try user/repos, or if it fails we can search.
        // Let's return error message.
        return NextResponse.json({
          error: `Failed to fetch repositories from GitHub: ${e.response?.data?.message || e.message}`
        }, { status: e.response?.status || 500 });
      }
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

import { ObjectId } from 'mongodb';
