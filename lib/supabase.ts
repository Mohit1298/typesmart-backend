import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client for public operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client with service role (full access)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Types
export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  apple_user_id: string | null;
  plan_type: 'free' | 'pro';
  monthly_credits: number;
  monthly_credits_used: number;
  bonus_credits: number;
  credits_reset_date: string;
  is_vip: boolean;
  is_admin: boolean;
  admin_notes: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  archived_at: string | null;  // Soft delete - account is archived, not deleted
  has_received_initial_credits: boolean;  // Prevent reinstall exploit
  created_at: string;
  last_active_at: string;
}

export interface CreditAdjustment {
  id: string;
  user_id: string;
  credits_added: number;
  adjustment_type: 'bonus' | 'refund' | 'promo' | 'compensation' | 'admin';
  reason: string | null;
  added_by_admin: string | null;
  created_at: string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  request_type: string;
  has_image: boolean;
  credits_used: number;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  created_at: string;
}

export interface GuestUsageLog {
  id: string;
  device_id: string;
  request_type: string;
  has_image: boolean;
  credits_used: number;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  converted_user_id: string | null;
  created_at: string;
}

export interface GuestCredit {
  device_id: string;
  total_credits_used: number;
  has_received_initial_credits: boolean;
  converted_user_id: string | null;
  created_at: string;
  last_used_at: string;
  requests_today: number;
  last_request_date: string;
}

// Helper functions
export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) return null;
  return data;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error) return null;
  return data;
}

export async function getAvailableCredits(userId: string): Promise<number> {
  const user = await getUserById(userId);
  if (!user) return 0;
  
  const monthlyRemaining = Math.max(0, user.monthly_credits - user.monthly_credits_used);
  return monthlyRemaining + user.bonus_credits;
}

export async function deductCredits(userId: string, credits: number): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;
  
  const available = await getAvailableCredits(userId);
  if (available < credits) return false;
  
  const monthlyRemaining = Math.max(0, user.monthly_credits - user.monthly_credits_used);
  
  if (monthlyRemaining >= credits) {
    // Deduct from monthly only
    await supabaseAdmin
      .from('users')
      .update({ monthly_credits_used: user.monthly_credits_used + credits })
      .eq('id', userId);
  } else {
    // Use all monthly + some bonus
    const bonusNeeded = credits - monthlyRemaining;
    await supabaseAdmin
      .from('users')
      .update({ 
        monthly_credits_used: user.monthly_credits,
        bonus_credits: user.bonus_credits - bonusNeeded
      })
      .eq('id', userId);
  }
  
  return true;
}

export async function addBonusCredits(
  userId: string, 
  credits: number, 
  reason: string, 
  adminEmail: string
): Promise<boolean> {
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ bonus_credits: supabaseAdmin.rpc('increment_bonus', { x: credits }) })
    .eq('id', userId);
  
  // Actually, let's do it directly
  const user = await getUserById(userId);
  if (!user) return false;
  
  const { error } = await supabaseAdmin
    .from('users')
    .update({ bonus_credits: user.bonus_credits + credits })
    .eq('id', userId);
  
  if (error) return false;
  
  // Log the adjustment
  await supabaseAdmin.from('credit_adjustments').insert({
    user_id: userId,
    credits_added: credits,
    adjustment_type: 'admin',
    reason,
    added_by_admin: adminEmail
  });
  
  return true;
}

export async function logUsage(
  userId: string,
  requestType: string,
  hasImage: boolean,
  creditsUsed: number,
  tokensInput?: number,
  tokensOutput?: number,
  costUsd?: number
): Promise<void> {
  await supabaseAdmin.from('usage_logs').insert({
    user_id: userId,
    request_type: requestType,
    has_image: hasImage,
    credits_used: creditsUsed,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    cost_usd: costUsd
  });
}

// Guest tracking functions
export async function logGuestUsage(
  deviceId: string,
  requestType: string,
  hasImage: boolean,
  creditsUsed: number,
  tokensInput?: number,
  tokensOutput?: number,
  costUsd?: number
): Promise<void> {
  await supabaseAdmin.from('guest_usage_logs').insert({
    device_id: deviceId,
    request_type: requestType,
    has_image: hasImage,
    credits_used: creditsUsed,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    cost_usd: costUsd
  });
}

export async function getOrCreateGuestCredit(deviceId: string, creditsUsed: number): Promise<GuestCredit> {
  // Try to get existing record
  const { data: existing } = await supabaseAdmin
    .from('guest_credits')
    .select('*')
    .eq('device_id', deviceId)
    .single();
  
  const today = new Date().toISOString().split('T')[0];
  
  if (existing) {
    // Update existing record
    const isNewDay = existing.last_request_date !== today;
    const newRequestsToday = isNewDay ? 1 : existing.requests_today + 1;
    
    const { data: updated } = await supabaseAdmin
      .from('guest_credits')
      .update({
        total_credits_used: existing.total_credits_used + creditsUsed,
        last_used_at: new Date().toISOString(),
        requests_today: newRequestsToday,
        last_request_date: today
      })
      .eq('device_id', deviceId)
      .select()
      .single();
    
    return updated!;
  } else {
    // Create new record
    const { data: created } = await supabaseAdmin
      .from('guest_credits')
      .insert({
        device_id: deviceId,
        total_credits_used: creditsUsed,
        requests_today: 1,
        last_request_date: today
      })
      .select()
      .single();
    
    return created!;
  }
}

export async function getGuestCredit(deviceId: string): Promise<GuestCredit | null> {
  const { data } = await supabaseAdmin
    .from('guest_credits')
    .select('*')
    .eq('device_id', deviceId)
    .single();
  
  return data;
}

export async function linkGuestDataToUser(deviceId: string, userId: string): Promise<void> {
  // Link all guest usage logs to the user
  await supabaseAdmin
    .from('guest_usage_logs')
    .update({ converted_user_id: userId })
    .eq('device_id', deviceId)
    .is('converted_user_id', null);
  
  // Link guest credit record to the user
  await supabaseAdmin
    .from('guest_credits')
    .update({ converted_user_id: userId })
    .eq('device_id', deviceId);
}
