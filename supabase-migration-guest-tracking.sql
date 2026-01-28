-- =============================================
-- GUEST TRACKING & EXPLOIT PREVENTION MIGRATION
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. ADD NEW FIELD TO EXISTING USERS TABLE
-- =============================================

-- Add has_received_initial_credits field to users table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'has_received_initial_credits'
    ) THEN
        ALTER TABLE users ADD COLUMN has_received_initial_credits BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added has_received_initial_credits column to users table';
    ELSE
        RAISE NOTICE 'Column has_received_initial_credits already exists';
    END IF;
END $$;

-- =============================================
-- 2. CREATE GUEST USAGE LOGS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS guest_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT NOT NULL,
    
    request_type TEXT NOT NULL CHECK (request_type IN ('rephrase', 'generate', 'grammar', 'formal', 'casual', 'analyze', 'reply', 'extract', 'custom')),
    has_image BOOLEAN DEFAULT FALSE,
    
    credits_used INT NOT NULL,
    tokens_input INT,
    tokens_output INT,
    
    -- For billing/analytics
    cost_usd DECIMAL(10, 6),
    
    -- Track if this guest later signed up
    converted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for guest_usage_logs
CREATE INDEX IF NOT EXISTS idx_guest_usage_device ON guest_usage_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_guest_usage_date ON guest_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_guest_usage_converted ON guest_usage_logs(converted_user_id);

-- =============================================
-- 3. CREATE GUEST CREDITS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS guest_credits (
    device_id TEXT PRIMARY KEY,
    
    -- Track credits used (for analytics)
    total_credits_used INT DEFAULT 0,
    
    -- Track if this device already received initial free credits (prevent exploit)
    has_received_initial_credits BOOLEAN DEFAULT FALSE,
    
    -- Track if this guest converted to a user
    converted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Optional: Rate limiting (requests per day)
    requests_today INT DEFAULT 0,
    last_request_date DATE DEFAULT CURRENT_DATE
);

-- Create indexes for guest_credits
CREATE INDEX IF NOT EXISTS idx_guest_credits_converted ON guest_credits(converted_user_id);
CREATE INDEX IF NOT EXISTS idx_guest_credits_last_used ON guest_credits(last_used_at);

-- =============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE guest_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_credits ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Service role full access guest logs" ON guest_usage_logs;
    DROP POLICY IF EXISTS "Service role full access guest credits" ON guest_credits;
    
    -- Create new policies
    CREATE POLICY "Service role full access guest logs" ON guest_usage_logs
        FOR ALL USING (auth.role() = 'service_role');
    
    CREATE POLICY "Service role full access guest credits" ON guest_credits
        FOR ALL USING (auth.role() = 'service_role');
END $$;

-- =============================================
-- 5. VERIFICATION QUERIES
-- =============================================

-- Check if tables were created successfully
DO $$ 
BEGIN
    RAISE NOTICE '✅ Migration complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Verification:';
    RAISE NOTICE '- users.has_received_initial_credits: %', 
        (SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'has_received_initial_credits'
        ));
    RAISE NOTICE '- guest_usage_logs table: %', 
        (SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'guest_usage_logs'
        ));
    RAISE NOTICE '- guest_credits table: %', 
        (SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'guest_credits'
        ));
END $$;

-- =============================================
-- DONE!
-- =============================================
-- You can now deploy your backend and iOS app.
-- The exploit prevention is active!
-- =============================================
