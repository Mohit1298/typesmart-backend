-- Voice Profiles Schema
-- Run this migration in Supabase SQL Editor

-- Voice profiles table - stores user voice cloning information
CREATE TABLE IF NOT EXISTS voice_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT, -- For guest users who don't have an account
    elevenlabs_voice_id TEXT NOT NULL,
    sample_storage_path TEXT, -- Path to original sample in Supabase Storage
    voice_name TEXT, -- Name given to the voice in ElevenLabs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one profile per user or device
    CONSTRAINT unique_user_voice UNIQUE(user_id),
    CONSTRAINT unique_device_voice UNIQUE(device_id),
    
    -- Either user_id or device_id must be set
    CONSTRAINT user_or_device CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

-- AI voice generation sessions - for analytics and debugging
CREATE TABLE IF NOT EXISTS ai_voice_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    device_id TEXT,
    original_audio_path TEXT, -- Path to the voice note being responded to
    transcription TEXT, -- What the user said
    response_count INTEGER NOT NULL, -- How many responses were generated
    responses JSONB, -- [{id, text, audio_path, selected}]
    credits_used INTEGER NOT NULL,
    voice_profile_used UUID REFERENCES voice_profiles(id) ON DELETE SET NULL,
    used_default_voice BOOLEAN DEFAULT FALSE, -- True if fallback voice was used
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Either user_id or device_id must be set
    CONSTRAINT session_user_or_device CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_voice_profiles_user_id ON voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_device_id ON voice_profiles(device_id);
CREATE INDEX IF NOT EXISTS idx_ai_voice_sessions_user_id ON ai_voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_voice_sessions_device_id ON ai_voice_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_ai_voice_sessions_created_at ON ai_voice_sessions(created_at);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_voice_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS voice_profiles_updated_at ON voice_profiles;
CREATE TRIGGER voice_profiles_updated_at
    BEFORE UPDATE ON voice_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_voice_profile_updated_at();

-- Row Level Security (RLS) Policies
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_voice_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own voice profiles
CREATE POLICY "Users can view own voice profile"
    ON voice_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice profile"
    ON voice_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice profile"
    ON voice_profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own voice profile"
    ON voice_profiles FOR DELETE
    USING (auth.uid() = user_id);

-- Users can only see their own AI voice sessions
CREATE POLICY "Users can view own ai_voice_sessions"
    ON ai_voice_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai_voice_sessions"
    ON ai_voice_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role can access all (for backend operations)
CREATE POLICY "Service role full access to voice_profiles"
    ON voice_profiles FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to ai_voice_sessions"
    ON ai_voice_sessions FOR ALL
    USING (auth.role() = 'service_role');

-- Create storage bucket for AI voice files if not exists
-- Note: Run this in Supabase Dashboard > Storage > New Bucket
-- Bucket name: ai-voice-files
-- Public: false

COMMENT ON TABLE voice_profiles IS 'Stores user voice cloning profiles for AI voice response feature';
COMMENT ON TABLE ai_voice_sessions IS 'Tracks AI voice generation sessions for analytics and debugging';
