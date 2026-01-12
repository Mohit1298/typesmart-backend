-- IAP Transactions Table
-- Run this in your Supabase SQL Editor

-- Create the iap_transactions table
CREATE TABLE IF NOT EXISTS iap_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL UNIQUE,
    original_transaction_id TEXT,
    product_id TEXT NOT NULL,
    credits_added INTEGER NOT NULL DEFAULT 0,
    is_subscription BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for fast lookups
    CONSTRAINT unique_transaction UNIQUE (transaction_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_iap_transactions_user_id ON iap_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_iap_transactions_transaction_id ON iap_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_iap_transactions_original_id ON iap_transactions(original_transaction_id);

-- Add comment
COMMENT ON TABLE iap_transactions IS 'Stores Apple In-App Purchase transactions to prevent duplicate processing';




