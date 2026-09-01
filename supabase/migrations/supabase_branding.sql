-- Add branding settings to organizations table
-- Run in Supabase SQL Editor

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}';

-- branding JSONB structure:
-- {
--   "logoUrl": "https://...",       -- URL to firm logo (hosted externally or in Supabase storage)
--   "accentColor": "#d4a843",       -- Primary accent color for memos
--   "footerText": "Confidential",   -- Custom footer line on exported memos
--   "memoTitle": "Credit Screening" -- Custom title override for memos
-- }
