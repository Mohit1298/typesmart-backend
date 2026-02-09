-- Add 'dictation' to usage_logs and guest_usage_logs request_type CHECK constraints
-- Run in Supabase SQL Editor

-- Usage logs: drop old constraint and add new one including 'dictation'
ALTER TABLE usage_logs DROP CONSTRAINT IF EXISTS usage_logs_request_type_check;
ALTER TABLE usage_logs ADD CONSTRAINT usage_logs_request_type_check
  CHECK (request_type IN ('rephrase', 'generate', 'grammar', 'formal', 'casual', 'analyze', 'reply', 'extract', 'custom', 'dictation'));

-- Guest usage logs: drop old constraint and add new one including 'dictation'
ALTER TABLE guest_usage_logs DROP CONSTRAINT IF EXISTS guest_usage_logs_request_type_check;
ALTER TABLE guest_usage_logs ADD CONSTRAINT guest_usage_logs_request_type_check
  CHECK (request_type IN ('rephrase', 'generate', 'grammar', 'formal', 'casual', 'analyze', 'reply', 'extract', 'custom', 'dictation'));
