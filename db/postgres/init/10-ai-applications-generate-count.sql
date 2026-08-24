-- How many times a document has been (re)generated via DeepSeek -- distinct
-- from generate_tokens_used (a cumulative token spend total), this is a
-- plain per-generation counter so the UI can show "Generated N times"
-- without inferring it from token counts. Bumped client-side the same way
-- suggest_tokens_used/generate_tokens_used already are (read the current
-- value, PATCH current+1 -- PostgREST has no atomic increment).
ALTER TABLE public.ai_applications ADD COLUMN IF NOT EXISTS generate_count integer NOT NULL DEFAULT 0;
