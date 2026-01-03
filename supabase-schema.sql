-- =============================================
-- OPENDOOR KEYBOARD - DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- NULL if using Apple Sign In
    apple_user_id TEXT UNIQUE, -- For Sign in with Apple
    
    -- Plan & Credits
    plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'pro')),
    monthly_credits INT DEFAULT 50,
    monthly_credits_used INT DEFAULT 0,
    bonus_credits INT DEFAULT 0, -- Manually added, never expire
    credits_reset_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 month'),
    
    -- VIP & Admin features
    is_vip BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    
    -- Stripe
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_apple_id ON users(apple_user_id);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

-- =============================================
-- CREDIT ADJUSTMENTS TABLE (Audit Log)
-- =============================================
CREATE TABLE credit_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    credits_added INT NOT NULL,
    adjustment_type TEXT DEFAULT 'bonus' CHECK (adjustment_type IN ('bonus', 'refund', 'promo', 'compensation', 'admin')),
    reason TEXT,
    
    added_by_admin TEXT, -- Admin email who made the change
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_adjustments_user ON credit_adjustments(user_id);

-- =============================================
-- USAGE LOG TABLE
-- =============================================
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    request_type TEXT NOT NULL CHECK (request_type IN ('rephrase', 'generate', 'grammar', 'formal', 'casual', 'analyze', 'reply', 'extract', 'custom')),
    has_image BOOLEAN DEFAULT FALSE,
    
    credits_used INT NOT NULL,
    tokens_input INT,
    tokens_output INT,
    
    -- For billing
    cost_usd DECIMAL(10, 6),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usage_user ON usage_logs(user_id);
CREATE INDEX idx_usage_date ON usage_logs(created_at);

-- =============================================
-- SUBSCRIPTIONS TABLE
-- =============================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete')),
    
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- =============================================
-- OVERAGE CHARGES TABLE (Pay-as-you-go)
-- =============================================
CREATE TABLE overage_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    credits_used INT NOT NULL,
    amount_usd DECIMAL(10, 2) NOT NULL,
    
    stripe_payment_intent_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    
    billing_period_start TIMESTAMP WITH TIME ZONE,
    billing_period_end TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to reset monthly credits
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.credits_reset_date <= NOW() THEN
        NEW.monthly_credits_used := 0;
        NEW.credits_reset_date := NOW() + INTERVAL '1 month';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-reset credits
CREATE TRIGGER trigger_reset_credits
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION reset_monthly_credits();

-- Function to get available credits for a user
CREATE OR REPLACE FUNCTION get_available_credits(p_user_id UUID)
RETURNS INT AS $$
DECLARE
    v_monthly_remaining INT;
    v_bonus INT;
BEGIN
    SELECT 
        GREATEST(0, monthly_credits - monthly_credits_used),
        bonus_credits
    INTO v_monthly_remaining, v_bonus
    FROM users 
    WHERE id = p_user_id;
    
    RETURN v_monthly_remaining + v_bonus;
END;
$$ LANGUAGE plpgsql;

-- Function to deduct credits
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_credits INT)
RETURNS BOOLEAN AS $$
DECLARE
    v_monthly_remaining INT;
    v_bonus INT;
    v_to_deduct INT;
BEGIN
    SELECT 
        GREATEST(0, monthly_credits - monthly_credits_used),
        bonus_credits
    INTO v_monthly_remaining, v_bonus
    FROM users 
    WHERE id = p_user_id
    FOR UPDATE;
    
    IF v_monthly_remaining + v_bonus < p_credits THEN
        RETURN FALSE;
    END IF;
    
    v_to_deduct := p_credits;
    
    -- First deduct from monthly credits
    IF v_monthly_remaining >= v_to_deduct THEN
        UPDATE users SET monthly_credits_used = monthly_credits_used + v_to_deduct WHERE id = p_user_id;
    ELSE
        -- Use all monthly, then bonus
        UPDATE users SET 
            monthly_credits_used = monthly_credits,
            bonus_credits = bonus_credits - (v_to_deduct - v_monthly_remaining)
        WHERE id = p_user_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

-- Service role can do everything
CREATE POLICY "Service role full access" ON users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access logs" ON usage_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access adjustments" ON credit_adjustments
    FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- SAMPLE DATA (Optional)
-- =============================================

-- Insert a test admin user
-- INSERT INTO users (email, is_admin, plan_type, monthly_credits, bonus_credits)
-- VALUES ('admin@yourcompany.com', true, 'unlimited', 9999, 0);

