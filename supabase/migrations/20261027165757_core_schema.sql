-- ASTERIAL v1.1 — Migration 01: Core Relational Schema & Triggers
-- Official Developer: Ritam Das | By X Huracan

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Updated-at timestamp helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 1. User Profiles (strictly separated from private auth.users email/credentials)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  bio text NOT NULL DEFAULT '',
  status_text text NOT NULL DEFAULT '',
  presence_visibility text NOT NULL DEFAULT 'everyone',
  read_receipts_enabled boolean NOT NULL DEFAULT true,
  allow_direct_messages text NOT NULL DEFAULT 'everyone',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9_]{3,24}$'),
  CONSTRAINT profiles_display_name_len CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 60),
  CONSTRAINT profiles_bio_len CHECK (char_length(bio) <= 280),
  CONSTRAINT profiles_status_len CHECK (char_length(status_text) <= 80),
  CONSTRAINT profiles_presence_visibility_chk CHECK (presence_visibility IN ('everyone', 'contacts', 'nobody')),
  CONSTRAINT profiles_allow_dm_chk CHECK (allow_direct_messages IN ('everyone', 'none'))
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx ON public.profiles USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx ON public.profiles USING gin (display_name gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Normalize username to lowercase on insert/update
CREATE OR REPLACE FUNCTION public.normalize_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.username := lower(btrim(NEW.username));
  NEW.display_name := btrim(NEW.display_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_normalize ON public.profiles;
CREATE TRIGGER trg_profiles_normalize
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_fields();

-- 2. User Presence State (separated from profiles for RLS-enforced last-seen privacy & low write churn)
CREATE TABLE IF NOT EXISTS public.user_presence_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Notification & Appearance Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  in_app_enabled boolean NOT NULL DEFAULT true,
  browser_enabled boolean NOT NULL DEFAULT false,
  sound_enabled boolean NOT NULL DEFAULT true,
  message_preview boolean NOT NULL DEFAULT true,
  dm_notifications boolean NOT NULL DEFAULT true,
  group_notifications boolean NOT NULL DEFAULT true,
  appearance_theme text NOT NULL DEFAULT 'obsidian',
  message_density text NOT NULL DEFAULT 'comfortable',
  reduced_motion boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notif_prefs_theme_chk CHECK (appearance_theme IN ('obsidian', 'pitch', 'graphite')),
  CONSTRAINT notif_prefs_density_chk CHECK (message_density IN ('compact', 'comfortable'))
);

DROP TRIGGER IF EXISTS trg_notif_prefs_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notif_prefs_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  direct_pair_key text UNIQUE,
  name text,
  description text NOT NULL DEFAULT '',
  avatar_url text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_id uuid,
  last_message_preview text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_type_chk CHECK (type IN ('direct', 'group')),
  CONSTRAINT conversations_pair_key_chk CHECK (
    (type = 'direct' AND direct_pair_key IS NOT NULL AND name IS NULL)
    OR (type = 'group' AND direct_pair_key IS NULL AND name IS NOT NULL AND char_length(btrim(name)) BETWEEN 1 AND 80)
  ),
  CONSTRAINT conversations_description_len CHECK (char_length(description) <= 300)
);

CREATE INDEX IF NOT EXISTS conversations_last_msg_at_idx ON public.conversations (last_message_at DESC NULLS LAST, created_at DESC);

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Conversation Members
CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  pinned boolean NOT NULL DEFAULT false,
  pinned_at timestamptz,
  is_muted boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  last_read_message_id uuid,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  unread_count integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT conv_members_role_chk CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT conv_members_unread_chk CHECK (unread_count >= 0)
);

CREATE INDEX IF NOT EXISTS conv_members_user_active_idx
  ON public.conversation_members (user_id, archived, pinned DESC)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS conv_members_conv_active_idx
  ON public.conversation_members (conversation_id)
  WHERE left_at IS NULL;

-- 6. Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_id text,
  kind text NOT NULL DEFAULT 'user',
  body text NOT NULL DEFAULT '',
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  has_attachments boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_kind_chk CHECK (kind IN ('user', 'system')),
  CONSTRAINT messages_body_len CHECK (char_length(body) <= 4000),
  CONSTRAINT messages_client_id_len CHECK (client_id IS NULL OR char_length(client_id) BETWEEN 8 AND 100),
  CONSTRAINT messages_unique_client_send UNIQUE (conversation_id, sender_id, client_id)
);

CREATE INDEX IF NOT EXISTS messages_conv_created_idx
  ON public.messages (conversation_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS messages_body_trgm_idx
  ON public.messages USING gin (body gin_trgm_ops)
  WHERE deleted_at IS NULL AND kind = 'user';

-- 7. Attachments
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'chat-attachments',
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attachments_bucket_chk CHECK (storage_bucket = 'chat-attachments'),
  CONSTRAINT attachments_file_name_len CHECK (char_length(btrim(file_name)) BETWEEN 1 AND 255),
  CONSTRAINT attachments_byte_size_chk CHECK (byte_size > 0 AND byte_size <= 15728640),
  CONSTRAINT attachments_dimensions_chk CHECK ((width IS NULL OR width > 0) AND (height IS NULL OR height > 0)),
  CONSTRAINT attachments_mime_chk CHECK (
    mime_type IN (
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/zip'
    )
  )
);

CREATE INDEX IF NOT EXISTS attachments_message_idx ON public.attachments (message_id);
CREATE INDEX IF NOT EXISTS attachments_conversation_idx ON public.attachments (conversation_id, created_at DESC);

-- 8. Message Receipts (Real delivery & read states)
CREATE TABLE IF NOT EXISTS public.message_receipts (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_receipts_conv_idx ON public.message_receipts (conversation_id, message_id);

-- 9. Message Reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji),
  CONSTRAINT message_reactions_emoji_len CHECK (char_length(btrim(emoji)) BETWEEN 1 AND 16)
);

CREATE INDEX IF NOT EXISTS message_reactions_conv_idx ON public.message_reactions (conversation_id, message_id);

-- 10. User Blocks
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT user_blocks_reason_len CHECK (char_length(reason) <= 200)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);

-- 11. Abuse & Moderation Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  category text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_category_chk CHECK (category IN ('spam', 'harassment', 'impersonation', 'illegal_content', 'other')),
  CONSTRAINT reports_status_chk CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  CONSTRAINT reports_details_len CHECK (char_length(details) <= 1000),
  CONSTRAINT reports_target_chk CHECK (
    reported_user_id IS NOT NULL OR conversation_id IS NOT NULL OR message_id IS NOT NULL
  )
);

-- 12. Internal Rate Limit Ledger (RLS locked, accessed only by constrained SECURITY DEFINER functions)
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_events_lookup_idx
  ON public.rate_limit_events (user_id, action, created_at DESC);

-- Distributed rate-limit check helper
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max_calls integer,
  p_window_seconds integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  --Opportunistic cleanup of expired events for this user/action
  DELETE FROM public.rate_limit_events
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at < now() - make_interval(secs => GREATEST(p_window_seconds * 2, 600));

  SELECT count(*)::integer
    INTO v_count
    FROM public.rate_limit_events
   WHERE user_id = p_user_id
     AND action = p_action
     AND created_at >= now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_max_calls THEN
    RAISE EXCEPTION 'Rate limit exceeded for %. Please wait a moment and try again.', p_action
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.rate_limit_events (user_id, action)
  VALUES (p_user_id, p_action);
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC;

-- Auto-provision profile, presence row, and notification preferences upon Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_username text;
  v_candidate text;
  v_display_name text;
  v_has_custom_username boolean := false;
BEGIN
  v_raw_username := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'username', ''), '[^a-z0-9_]', '', 'g'));
  IF char_length(v_raw_username) BETWEEN 3 AND 24 THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_raw_username) THEN
      v_candidate := v_raw_username;
      v_has_custom_username := true;
    END IF;
  END IF;

  IF v_candidate IS NULL THEN
    v_candidate := 'ast_' || substr(replace(NEW.id::text, '-', ''), 1, 10);
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = v_candidate) LOOP
      v_candidate := 'ast_' || substr(encode(gen_random_bytes(6), 'hex'), 1, 10);
    END LOOP;
  END IF;

  v_display_name := btrim(coalesce(NEW.raw_user_meta_data->>'display_name', ''));
  IF char_length(v_display_name) < 1 OR char_length(v_display_name) > 60 THEN
    v_display_name := v_candidate;
  END IF;

  INSERT INTO public.profiles (id, username, display_name, onboarding_completed)
  VALUES (NEW.id, v_candidate, v_display_name, v_has_custom_username)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_presence_state (user_id, last_seen_at)
  VALUES (NEW.id, now())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Guard direct updates to conversation_members so clients can only toggle personal view preferences (pin/mute/archive)
CREATE OR REPLACE FUNCTION public.guard_conversation_member_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(current_setting('asterial.trusted_rpc', true), '') <> '1'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF OLD.left_at IS NOT NULL THEN
      RAISE EXCEPTION 'Inactive membership cannot be modified.' USING ERRCODE = '42501';
    END IF;
    IF NEW.conversation_id <> OLD.conversation_id
       OR NEW.user_id <> OLD.user_id
       OR NEW.role <> OLD.role
       OR NEW.joined_at IS DISTINCT FROM OLD.joined_at
       OR NEW.left_at IS DISTINCT FROM OLD.left_at THEN
      RAISE EXCEPTION 'Membership role and lifecycle fields are server-managed.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.pinned = true AND OLD.pinned = false THEN
    NEW.pinned_at := coalesce(NEW.pinned_at, now());
  ELSIF NEW.pinned = false THEN
    NEW.pinned_at := NULL;
  END IF;

  IF NEW.archived = true AND OLD.archived = false THEN
    NEW.archived_at := coalesce(NEW.archived_at, now());
  ELSIF NEW.archived = false THEN
    NEW.archived_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_conv_member_update ON public.conversation_members;
CREATE TRIGGER trg_guard_conv_member_update
BEFORE UPDATE ON public.conversation_members
FOR EACH ROW EXECUTE FUNCTION public.guard_conversation_member_update();

-- Message insert validation & rate-limiting trigger
CREATE OR REPLACE FUNCTION public.before_message_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reply_conv uuid;
BEGIN
  IF NEW.kind = 'user' THEN
    IF coalesce(current_setting('asterial.trusted_rpc', true), '') <> '1'
       AND NEW.sender_id IS NOT NULL THEN
      PERFORM public.check_rate_limit(NEW.sender_id, 'send_message', 60, 60);
    END IF;

    IF char_length(btrim(coalesce(NEW.body, ''))) = 0 AND NEW.has_attachments = false THEN
      RAISE EXCEPTION 'Message cannot be empty.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.reply_to_id IS NOT NULL THEN
    SELECT conversation_id INTO v_reply_conv
      FROM public.messages
     WHERE id = NEW.reply_to_id;
    IF v_reply_conv IS NULL OR v_reply_conv <> NEW.conversation_id THEN
      RAISE EXCEPTION 'Replied message does not belong to this conversation.' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_message_insert ON public.messages;
CREATE TRIGGER trg_before_message_insert
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.before_message_insert_guard();

-- Synchronize conversation preview & unread counters on message insert
CREATE OR REPLACE FUNCTION public.after_message_insert_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_preview text;
BEGIN
  PERFORM set_config('asterial.trusted_rpc', '1', true);

  IF NEW.deleted_at IS NOT NULL THEN
    v_preview := 'Message deleted';
  ELSIF char_length(btrim(NEW.body)) > 0 THEN
    v_preview := left(regexp_replace(btrim(NEW.body), '\s+', ' ', 'g'), 140);
  ELSIF NEW.has_attachments THEN
    v_preview := 'Shared an attachment';
  ELSE
    v_preview := '';
  END IF;

  UPDATE public.conversations
     SET last_message_id = NEW.id,
         last_message_preview = v_preview,
         last_message_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.conversation_id;

  IF NEW.sender_id IS NOT NULL THEN
    UPDATE public.conversation_members
       SET last_read_message_id = NEW.id,
           last_read_at = NEW.created_at,
           unread_count = 0
     WHERE conversation_id = NEW.conversation_id
       AND user_id = NEW.sender_id
       AND left_at IS NULL;
  END IF;

  IF NEW.kind = 'user' THEN
    UPDATE public.conversation_members
       SET unread_count = unread_count + 1
     WHERE conversation_id = NEW.conversation_id
       AND (NEW.sender_id IS NULL OR user_id <> NEW.sender_id)
       AND left_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_message_insert ON public.messages;
CREATE TRIGGER trg_after_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.after_message_insert_sync();

-- Guard message edits and soft-deletes
CREATE OR REPLACE FUNCTION public.before_message_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_storage_paths text[];
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.conversation_id <> OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.kind <> OLD.kind
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Immutable message fields cannot be altered.' USING ERRCODE = '42501';
  END IF;

  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Deleted messages cannot be edited or restored.' USING ERRCODE = '42501';
  END IF;

  -- Soft-deletion wipes plaintext content and removes attachments
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.body := '';
    NEW.has_attachments := false;
    NEW.edited_at := NULL;
    NEW.updated_at := now();

    SELECT array_agg(storage_path) INTO v_storage_paths
      FROM public.attachments
     WHERE message_id = OLD.id;

    DELETE FROM public.attachments WHERE message_id = OLD.id;

    IF v_storage_paths IS NOT NULL THEN
      DELETE FROM storage.objects
       WHERE bucket_id = 'chat-attachments'
         AND name = ANY(v_storage_paths);
    END IF;

    UPDATE public.conversations
       SET last_message_preview = 'Message deleted',
           updated_at = now()
     WHERE id = OLD.conversation_id
       AND last_message_id = OLD.id;

    RETURN NEW;
  END IF;

  -- Content edit
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    IF char_length(btrim(NEW.body)) = 0 AND NEW.has_attachments = false THEN
      RAISE EXCEPTION 'Edited message cannot be empty.' USING ERRCODE = '22023';
    END IF;
    NEW.edited_at := now();
    NEW.updated_at := now();

    UPDATE public.conversations
       SET last_message_preview = left(regexp_replace(btrim(NEW.body), '\s+', ' ', 'g'), 140),
           updated_at = now()
     WHERE id = OLD.conversation_id
       AND last_message_id = OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_message_update ON public.messages;
CREATE TRIGGER trg_before_message_update
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.before_message_update_guard();

-- Rate-limit abuse reports
CREATE OR REPLACE FUNCTION public.before_report_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.check_rate_limit(NEW.reporter_id, 'submit_report', 10, 300);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_report_insert ON public.reports;
CREATE TRIGGER trg_before_report_insert
BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.before_report_insert_guard();
