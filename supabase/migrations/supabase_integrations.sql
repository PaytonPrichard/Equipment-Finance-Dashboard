-- ============================================================
-- Integrations: API Keys + Webhooks
-- Run this in Supabase SQL Editor
-- ============================================================

-- API Keys — hashed, never store plaintext
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  key_prefix TEXT NOT NULL,          -- first 8 chars for display (trn_xxxx)
  key_hash TEXT NOT NULL UNIQUE,     -- SHA-256 of full key
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_org_read" ON public.api_keys
  FOR SELECT USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "api_keys_org_insert" ON public.api_keys
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "api_keys_org_update" ON public.api_keys
  FOR UPDATE USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Webhooks — configurable per org
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,               -- HMAC signing secret
  events TEXT[] NOT NULL DEFAULT ARRAY['deal.created','deal.scored','pipeline.stage_changed'],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhooks_org_read" ON public.webhooks
  FOR SELECT USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "webhooks_org_insert" ON public.webhooks
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "webhooks_org_update" ON public.webhooks
  FOR UPDATE USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "webhooks_org_delete" ON public.webhooks
  FOR DELETE USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  status_code INTEGER,
  delivered_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_logs_org_read" ON public.webhook_logs
  FOR SELECT USING (webhook_id IN (
    SELECT id FROM webhooks WHERE org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid())
  ));

-- Index for API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys (key_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON public.api_keys (org_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON public.webhooks (org_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON public.webhook_logs (webhook_id);
