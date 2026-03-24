-- Run in Supabase SQL Editor (once) if the table does not exist yet.
-- Stores admin push notification sends for auditing and the dashboard history view.

CREATE TABLE IF NOT EXISTS push_notification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    audience TEXT NOT NULL,
    audience_detail JSONB,
    targeted_count INT NOT NULL DEFAULT 0,
    sent_count INT,
    failed_count INT,
    dry_run BOOLEAN NOT NULL DEFAULT FALSE,
    admin_email TEXT,
    failures_sample JSONB,
    invalid_tokens_removed INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_notification_history_created
    ON push_notification_history (created_at DESC);

ALTER TABLE push_notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access push_notification_history"
    ON push_notification_history
    FOR ALL
    USING (auth.role() = 'service_role');
