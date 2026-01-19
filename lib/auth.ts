import { NextApiRequest } from 'next';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabaseAdmin, User, getUserById } from './supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRY = '30d';

export interface TokenPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export function generateToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    isAdmin: user.is_admin,
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticateRequest(req: NextApiRequest): Promise<User | null> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  
  if (!payload) {
    return null;
  }
  
  const user = await getUserById(payload.userId);
  return user;
}

export async function requireAuth(req: NextApiRequest): Promise<User> {
  const user = await authenticateRequest(req);
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

export async function requireAdmin(req: NextApiRequest): Promise<User> {
  const user = await requireAuth(req);
  
  if (!user.is_admin) {
    throw new Error('Admin access required');
  }
  
  return user;
}

// Sign in with Apple verification
export async function verifyAppleToken(identityToken: string): Promise<{
  email: string;
  appleUserId: string;
} | null> {
  // In production, you would verify the token with Apple's servers
  // For now, we'll decode the JWT and extract the claims
  try {
    const decoded = jwt.decode(identityToken) as any;
    
    if (!decoded || !decoded.sub) {
      return null;
    }
    
    return {
      email: decoded.email || `${decoded.sub}@privaterelay.appleid.com`,
      appleUserId: decoded.sub,
    };
  } catch {
    return null;
  }
}

// Create or get user from Apple Sign In
// localCreditsToMerge: credits from device to merge into account (only for new users)
export async function getOrCreateAppleUser(
  appleUserId: string,
  email: string,
  localCreditsToMerge?: number
): Promise<User> {
  // Check if user exists
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('apple_user_id', appleUserId)
    .single();
  
  if (existingUser) {
    // Existing user - local credits will be merged separately in the endpoint
    return existingUser;
  }
  
  // Also check by email
  const { data: emailUser } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (emailUser) {
    // Link Apple ID to existing account
    await supabaseAdmin
      .from('users')
      .update({ apple_user_id: appleUserId })
      .eq('id', emailUser.id);
    
    // Existing user - local credits will be merged separately in the endpoint
    return { ...emailUser, apple_user_id: appleUserId };
  }
  
  // Calculate initial credits for new user
  const initialBonusCredits = localCreditsToMerge && localCreditsToMerge > 0 ? localCreditsToMerge : 0;
  
  // Create new user with merged local credits
  const { data: newUser, error } = await supabaseAdmin
    .from('users')
    .insert({
      email,
      apple_user_id: appleUserId,
      plan_type: 'free',
      monthly_credits: 50,
      bonus_credits: initialBonusCredits,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error('Failed to create user');
  }
  
  if (localCreditsToMerge && localCreditsToMerge > 0) {
    console.log(`New Apple user ${newUser.id} created with ${localCreditsToMerge} merged local credits`);
  }
  
  return newUser;
}






