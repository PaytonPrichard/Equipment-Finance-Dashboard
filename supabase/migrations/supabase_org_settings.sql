-- Add org_settings column for firm-level credit policy overrides
-- Run in Supabase SQL Editor

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS org_settings JSONB DEFAULT '{}';

-- org_settings JSONB structure:
-- {
--   "baseSpreadBps": 200,         -- Base credit spread in basis points
--   "creditSpreadStrong": -75,    -- Adjustment for Strong credit
--   "creditSpreadWeak": 200,      -- Adjustment for Weak credit
--   "maxAdvanceRateAR": 85,       -- Max AR advance rate (%)
--   "maxAdvanceRateInvFinished": 65, -- Max inventory finished goods rate (%)
--   "maxAdvanceRateInvRaw": 50,   -- Max inventory raw materials rate (%)
--   "minDscrDefault": 1.25,       -- Default minimum DSCR
--   "maxLeverageDefault": 5.0,    -- Default maximum leverage
-- }
