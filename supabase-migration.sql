-- =============================================
-- MIGRATION: Remove Unlimited Plan
-- Run this if tables already exist
-- =============================================

-- Option 1: If you want to KEEP existing data, run this:

-- Update the plan_type constraint to only allow 'free' and 'pro'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_type_check;
ALTER TABLE users ADD CONSTRAINT users_plan_type_check CHECK (plan_type IN ('free', 'pro'));

-- Convert any existing 'unlimited' users to 'pro'
UPDATE users SET plan_type = 'pro' WHERE plan_type = 'unlimited';

-- Update the function to remove unlimited check
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

-- Done! Your database now only supports 'free' and 'pro' plans.



-- =============================================
-- Option 2: If you want to START FRESH (deletes all data!)
-- Uncomment and run the lines below instead:
-- =============================================

-- DROP TABLE IF EXISTS overage_charges CASCADE;
-- DROP TABLE IF EXISTS subscriptions CASCADE;
-- DROP TABLE IF EXISTS usage_logs CASCADE;
-- DROP TABLE IF EXISTS credit_adjustments CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP FUNCTION IF EXISTS reset_monthly_credits CASCADE;
-- DROP FUNCTION IF EXISTS get_available_credits CASCADE;
-- DROP FUNCTION IF EXISTS deduct_credits CASCADE;

-- Then run the full supabase-schema.sql again






