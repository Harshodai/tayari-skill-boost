BEGIN;

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS whatsapp_wa_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_link_code_digest TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_link_code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_link_attempts INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_notification_preferences_whatsapp_link
  ON public.notification_preferences (whatsapp_link_code_expires_at)
  WHERE whatsapp_link_code_digest IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_preferences_whatsapp_link_digest
  ON public.notification_preferences (whatsapp_link_code_digest)
  WHERE whatsapp_link_code_digest IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_preferences_whatsapp_identity
  ON public.notification_preferences (whatsapp_wa_id)
  WHERE whatsapp_wa_id IS NOT NULL;

COMMIT;
