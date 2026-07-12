import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'a74d2b99f36c81e5509d3b84f721a8cd36f18ea0c7b94d52184e9c7b0d2358fb';

export interface UserSession {
  userId: string;
  email: string;
}

export function generateToken(payload: UserSession): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSession;
  } catch (error) {
    return null;
  }
}

export function getSession(req: NextRequest): UserSession | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return verifyToken(token);
  }
  
  const tokenCookie = req.cookies.get('token')?.value;
  if (tokenCookie) {
    return verifyToken(tokenCookie);
  }
  
  return null;
}
