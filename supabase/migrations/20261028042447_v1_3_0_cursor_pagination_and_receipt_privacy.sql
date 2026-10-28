-- ASTERIAL v1.3.0 — Additive Migration: Composite Cursor Pagination & Read-Receipt Privacy Guard
-- Official Developer: Ritam Das | By X Huracan
--
-- Summary:
--   1. Adds a BEFORE INSERT OR UPDATE trigger on public.message_receipts so direct client
--      writes cannot record read_at timestamps when the recipient has read_receipts_enabled = false.
--   2. Adds public.get_conversation_messages_page() for strict (created_at, id) keyset cursor
--      pagination backed by messages_conv_created_idx, enforcing active conversation membership.
--   3. Adds public.get_inbox_page() for deterministic paginated inbox loading across Web & Android.
--
-- Rollback (reversible without data loss):
--   DROP FUNCTION IF EXISTS public.get_inbox_page(integer, integer, boolean);
--   DROP FUNCTION IF EXISTS public.get_conversation_messages_page(uuid, timestamptz, uuid, integer);
--   DROP TRIGGER IF EXISTS trg_enforce_receipt_privacy ON public.message_receipts;
--   DROP FUNCTION IF EXISTS public.enforce_receipt_privacy_guard();

-- 1. Enforce recipient read-receipt privacy even on direct PostgREST INSERT/UPDATE calls
CREATE OR REPLACE FUNCTION public.enforce_receipt_privacy_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share_read boolean := true;
BEGIN
  IF NEW.read_at IS NOT NULL THEN
    SELECT coalesce(p.read_receipts_enabled, true)
      INTO v_share_read
      FROM public.profiles p
     WHERE p.id = NEW.user_id;

    IF NOT coalesce(v_share_read, true) THEN
      IF TG_OP = 'UPDATE' THEN
        NEW.read_at := OLD.read_at;
      ELSE
        NEW.read_at := NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_receipt_privacy ON public.message_receipts;
CREATE TRIGGER trg_enforce_receipt_privacy
BEFORE INSERT OR UPDATE ON public.message_receipts
FOR EACH ROW EXECUTE FUNCTION public.enforce_receipt_privacy_guard();

-- 2. Strict composite keyset cursor pagination for conversation messages
CREATE OR REPLACE FUNCTION public.get_conversation_messages_page(
  p_conversation_id uuid,
  p_before_created_at timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 35
)
RETURNS SETOF public.messages
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lim integer := LEAST(GREATEST(coalesce(p_limit, 35), 1), 100);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_conversation_member(p_conversation_id, v_uid) THEN
    RAISE EXCEPTION 'Conversation access denied.' USING ERRCODE = '42501';
  END IF;

  IF p_before_created_at IS NOT NULL AND p_before_id IS NOT NULL THEN
    RETURN QUERY
    SELECT m.*
      FROM public.messages m
     WHERE m.conversation_id = p_conversation_id
       AND (m.created_at, m.id) < (p_before_created_at, p_before_id)
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT v_lim;
  ELSIF p_before_created_at IS NOT NULL THEN
    RETURN QUERY
    SELECT m.*
      FROM public.messages m
     WHERE m.conversation_id = p_conversation_id
       AND m.created_at < p_before_created_at
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT v_lim;
  ELSE
    RETURN QUERY
    SELECT m.*
      FROM public.messages m
     WHERE m.conversation_id = p_conversation_id
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT v_lim;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_messages_page(uuid, timestamptz, uuid, integer) TO authenticated;

-- 3. Deterministic paginated inbox query for efficient mobile & web list rendering
CREATE OR REPLACE FUNCTION public.get_inbox_page(
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0,
  p_include_archived boolean DEFAULT false
)
RETURNS TABLE (
  conversation_id uuid,
  pinned boolean,
  pinned_at timestamptz,
  archived boolean,
  sort_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lim integer := LEAST(GREATEST(coalesce(p_limit, 30), 1), 100);
  v_off integer := GREATEST(coalesce(p_offset, 0), 0);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.id AS conversation_id,
    cm.pinned,
    cm.pinned_at,
    cm.archived,
    coalesce(c.last_message_at, c.created_at) AS sort_at
  FROM public.conversation_members cm
  JOIN public.conversations c ON c.id = cm.conversation_id
  WHERE cm.user_id = v_uid
    AND cm.left_at IS NULL
    AND (p_include_archived OR cm.archived = false)
  ORDER BY
    cm.pinned DESC,
    cm.pinned_at DESC NULLS LAST,
    coalesce(c.last_message_at, c.created_at) DESC,
    c.id DESC
  LIMIT v_lim
  OFFSET v_off;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inbox_page(integer, integer, boolean) TO authenticated;
