-- ASTERIAL v1.4.0 — Phase 3 Additive Migration: Orbits (Communities), Moments (Temporary Updates) & Social Feed
-- Official Developer: Ritam Das | By X Huracan
-- Safety: 100% additive & idempotent. Preserves all existing profiles, conversations, messages, attachments, and preferences.

-- ============================================================================
-- 1. EXTEND NOTIFICATION PREFERENCES THEME CHECK (Ensure all 4 themes allowed)
-- ============================================================================
ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notif_prefs_theme_chk;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notif_prefs_theme_chk
  CHECK (appearance_theme IN ('obsidian', 'pitch', 'graphite', 'alabaster'));

-- ============================================================================
-- 2. ORBITS — FIRST-CLASS COMMUNITY SYSTEM (Roles, Visibility, Channels, Messages)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orbits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon_url text,
  visibility text NOT NULL DEFAULT 'public',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_count integer NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orbits_slug_format_chk CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,34}[a-z0-9]$'),
  CONSTRAINT orbits_name_len_chk CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  CONSTRAINT orbits_desc_len_chk CHECK (char_length(description) <= 500),
  CONSTRAINT orbits_visibility_chk CHECK (visibility IN ('public', 'private')),
  CONSTRAINT orbits_member_count_chk CHECK (member_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS orbits_slug_lower_uidx ON public.orbits (lower(slug));
CREATE INDEX IF NOT EXISTS orbits_discover_idx
  ON public.orbits (visibility, member_count DESC, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS orbits_name_trgm_idx
  ON public.orbits USING gin (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_orbits_updated_at ON public.orbits;
CREATE TRIGGER trg_orbits_updated_at
BEFORE UPDATE ON public.orbits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.orbit_members (
  orbit_id uuid NOT NULL REFERENCES public.orbits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (orbit_id, user_id),
  CONSTRAINT orbit_members_role_chk CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT orbit_members_status_chk CHECK (status IN ('active', 'invited', 'banned', 'left'))
);

CREATE INDEX IF NOT EXISTS orbit_members_user_active_idx
  ON public.orbit_members (user_id, joined_at DESC)
  WHERE status IN ('active', 'invited');
CREATE INDEX IF NOT EXISTS orbit_members_orbit_active_idx
  ON public.orbit_members (orbit_id, role)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_orbit_members_updated_at ON public.orbit_members;
CREATE TRIGGER trg_orbit_members_updated_at
BEFORE UPDATE ON public.orbit_members
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.orbit_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orbit_id uuid NOT NULL REFERENCES public.orbits(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  topic text NOT NULL DEFAULT '',
  is_announcement boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  last_message_preview text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orbit_channels_slug_chk CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$'),
  CONSTRAINT orbit_channels_name_len_chk CHECK (char_length(btrim(name)) BETWEEN 1 AND 50),
  CONSTRAINT orbit_channels_topic_len_chk CHECK (char_length(topic) <= 240),
  CONSTRAINT orbit_channels_unique_slug UNIQUE (orbit_id, slug)
);

CREATE INDEX IF NOT EXISTS orbit_channels_orbit_sort_idx
  ON public.orbit_channels (orbit_id, sort_order ASC, created_at ASC);

DROP TRIGGER IF EXISTS trg_orbit_channels_updated_at ON public.orbit_channels;
CREATE TRIGGER trg_orbit_channels_updated_at
BEFORE UPDATE ON public.orbit_channels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.orbit_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orbit_id uuid NOT NULL REFERENCES public.orbits(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.orbit_channels(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_id text,
  kind text NOT NULL DEFAULT 'user',
  body text NOT NULL DEFAULT '',
  reply_to_id uuid REFERENCES public.orbit_messages(id) ON DELETE SET NULL,
  attachment_path text,
  attachment_name text,
  attachment_mime text,
  attachment_size bigint,
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orbit_messages_kind_chk CHECK (kind IN ('user', 'system')),
  CONSTRAINT orbit_messages_body_len_chk CHECK (char_length(body) <= 4000),
  CONSTRAINT orbit_messages_client_id_chk CHECK (client_id IS NULL OR char_length(client_id) BETWEEN 8 AND 100),
  CONSTRAINT orbit_messages_unique_client UNIQUE (channel_id, sender_id, client_id),
  CONSTRAINT orbit_messages_att_size_chk CHECK (attachment_size IS NULL OR (attachment_size > 0 AND attachment_size <= 15728640)),
  CONSTRAINT orbit_messages_att_mime_chk CHECK (
    attachment_mime IS NULL OR attachment_mime IN (
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/zip'
    )
  )
);

CREATE INDEX IF NOT EXISTS orbit_messages_channel_cursor_idx
  ON public.orbit_messages (channel_id, created_at DESC, id DESC);

-- ============================================================================
-- 3. MOMENTS — EPHEMERAL / TEMPORARY UPDATES (Explicit Expiration & Audience)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  caption text NOT NULL DEFAULT '',
  background_tone text NOT NULL DEFAULT 'obsidian',
  media_path text,
  media_mime text,
  media_width integer,
  media_height integer,
  audience text NOT NULL DEFAULT 'everyone',
  duration_hours integer NOT NULL DEFAULT 24,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  deleted_at timestamptz,
  CONSTRAINT moments_caption_len_chk CHECK (char_length(caption) <= 500),
  CONSTRAINT moments_tone_chk CHECK (background_tone IN ('obsidian', 'graphite', 'slate', 'ivory')),
  CONSTRAINT moments_audience_chk CHECK (audience IN ('everyone', 'contacts')),
  CONSTRAINT moments_duration_chk CHECK (duration_hours IN (6, 12, 24, 48)),
  CONSTRAINT moments_view_count_chk CHECK (view_count >= 0),
  CONSTRAINT moments_expiry_window_chk CHECK (expires_at > created_at AND expires_at <= created_at + interval '49 hours'),
  CONSTRAINT moments_media_mime_chk CHECK (
    media_mime IS NULL OR media_mime IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')
  ),
  CONSTRAINT moments_non_empty_chk CHECK (
    deleted_at IS NOT NULL OR char_length(btrim(caption)) > 0 OR media_path IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS moments_active_expires_idx
  ON public.moments (expires_at DESC, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS moments_author_active_idx
  ON public.moments (author_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.moment_views (
  moment_id uuid NOT NULL REFERENCES public.moments(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (moment_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS moment_views_viewer_idx ON public.moment_views (viewer_id, viewed_at DESC);

-- ============================================================================
-- 4. SOCIAL FEED — PERSISTENT POSTS, LIKES & COMMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'public',
  media_path text,
  media_mime text,
  media_name text,
  media_size bigint,
  media_width integer,
  media_height integer,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT posts_body_len_chk CHECK (char_length(body) <= 2000),
  CONSTRAINT posts_visibility_chk CHECK (visibility IN ('public', 'contacts')),
  CONSTRAINT posts_counts_chk CHECK (like_count >= 0 AND comment_count >= 0),
  CONSTRAINT posts_media_size_chk CHECK (media_size IS NULL OR (media_size > 0 AND media_size <= 15728640)),
  CONSTRAINT posts_media_mime_chk CHECK (
    media_mime IS NULL OR media_mime IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')
  ),
  CONSTRAINT posts_non_empty_chk CHECK (
    deleted_at IS NOT NULL OR char_length(btrim(body)) > 0 OR media_path IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS posts_feed_cursor_idx
  ON public.posts (created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS posts_author_cursor_idx
  ON public.posts (author_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_posts_updated_at ON public.posts;
CREATE TRIGGER trg_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_likes_user_idx ON public.post_likes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_comments_body_chk CHECK (
    deleted_at IS NOT NULL OR char_length(btrim(body)) BETWEEN 1 AND 1000
  )
);

CREATE INDEX IF NOT EXISTS post_comments_post_created_idx
  ON public.post_comments (post_id, created_at ASC, id ASC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_post_comments_updated_at ON public.post_comments;
CREATE TRIGGER trg_post_comments_updated_at
BEFORE UPDATE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend reports table additively for Orbits, Posts & Moments
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS orbit_id uuid REFERENCES public.orbits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moment_id uuid REFERENCES public.moments(id) ON DELETE SET NULL;

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_target_chk;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_target_chk CHECK (
    reported_user_id IS NOT NULL
    OR conversation_id IS NOT NULL
    OR message_id IS NOT NULL
    OR orbit_id IS NOT NULL
    OR post_id IS NOT NULL
    OR moment_id IS NOT NULL
  );

-- ============================================================================
-- 5. SECURITY DEFINER AUTHORIZATION HELPERS & INTEGRITY TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_orbit_member(
  p_orbit_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.orbit_members om
      JOIN public.orbits o ON o.id = om.orbit_id
     WHERE om.orbit_id = p_orbit_id
       AND om.user_id = p_user_id
       AND om.status = 'active'
       AND o.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.get_orbit_role(
  p_orbit_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT om.role
    FROM public.orbit_members om
    JOIN public.orbits o ON o.id = om.orbit_id
   WHERE om.orbit_id = p_orbit_id
     AND om.user_id = p_user_id
     AND om.status = 'active'
     AND o.deleted_at IS NULL
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_view_orbit(
  p_orbit_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.orbits o
     WHERE o.id = p_orbit_id
       AND o.deleted_at IS NULL
       AND (
         o.visibility = 'public'
         OR EXISTS (
           SELECT 1
             FROM public.orbit_members om
            WHERE om.orbit_id = o.id
              AND om.user_id = p_user_id
              AND om.status IN ('active', 'invited')
         )
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_post(
  p_post_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.posts p
     WHERE p.id = p_post_id
       AND p.deleted_at IS NULL
       AND p_user_id IS NOT NULL
       AND (
         p.author_id = p_user_id
         OR (
           NOT public.is_blocked_between(p_user_id, p.author_id)
           AND (
             p.visibility = 'public'
             OR (
               p.visibility = 'contacts'
               AND public.has_shared_direct_conversation(p_user_id, p.author_id)
             )
           )
         )
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_moment(
  p_moment_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.moments m
     WHERE m.id = p_moment_id
       AND m.deleted_at IS NULL
       AND m.expires_at > now()
       AND p_user_id IS NOT NULL
       AND (
         m.author_id = p_user_id
         OR (
           NOT public.is_blocked_between(p_user_id, m.author_id)
           AND (
             m.audience = 'everyone'
             OR (
               m.audience = 'contacts'
               AND public.has_shared_direct_conversation(p_user_id, m.author_id)
             )
           )
         )
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_social_media_object(
  p_object_name text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parts text[];
  v_domain text;
  v_owner text;
BEGIN
  IF p_user_id IS NULL OR p_object_name IS NULL THEN
    RETURN false;
  END IF;

  v_parts := storage.foldername(p_object_name);
  IF array_length(v_parts, 1) < 2 THEN
    RETURN false;
  END IF;

  v_domain := v_parts[1];
  v_owner := v_parts[2];

  IF v_owner = p_user_id::text THEN
    RETURN true;
  END IF;

  IF v_domain = 'posts' THEN
    RETURN EXISTS (
      SELECT 1
        FROM public.posts p
       WHERE p.media_path = p_object_name
         AND public.can_view_post(p.id, p_user_id)
    );
  ELSIF v_domain = 'moments' THEN
    RETURN EXISTS (
      SELECT 1
        FROM public.moments m
       WHERE m.media_path = p_object_name
         AND public.can_view_moment(m.id, p_user_id)
    );
  ELSIF v_domain = 'orbits' THEN
    IF array_length(v_parts, 1) >= 3
       AND v_parts[3] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      RETURN public.is_orbit_member((v_parts[3])::uuid, p_user_id);
    END IF;
    RETURN false;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_orbit_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_orbit_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_orbit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_post(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_moment(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_social_media_object(text, uuid) TO authenticated;

-- Sync Orbit member_count automatically
CREATE OR REPLACE FUNCTION public.sync_orbit_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orbit_id uuid := coalesce(NEW.orbit_id, OLD.orbit_id);
BEGIN
  UPDATE public.orbits o
     SET member_count = (
       SELECT count(*)::integer
         FROM public.orbit_members om
        WHERE om.orbit_id = v_orbit_id
          AND om.status = 'active'
     )
   WHERE o.id = v_orbit_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_orbit_member_count ON public.orbit_members;
CREATE TRIGGER trg_sync_orbit_member_count
AFTER INSERT OR UPDATE OR DELETE ON public.orbit_members
FOR EACH ROW EXECUTE FUNCTION public.sync_orbit_member_count();

-- Guard & sync Orbit messages
CREATE OR REPLACE FUNCTION public.before_orbit_message_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_chan_orbit uuid;
  v_is_ann boolean;
  v_role text;
BEGIN
  SELECT orbit_id, is_announcement
    INTO v_chan_orbit, v_is_ann
    FROM public.orbit_channels
   WHERE id = NEW.channel_id;

  IF v_chan_orbit IS NULL OR v_chan_orbit <> NEW.orbit_id THEN
    RAISE EXCEPTION 'Channel does not belong to the specified Orbit.' USING ERRCODE = '22023';
  END IF;

  IF NEW.kind = 'user' THEN
    IF coalesce(current_setting('asterial.trusted_rpc', true), '') <> '1'
       AND NEW.sender_id IS NOT NULL THEN
      PERFORM public.check_rate_limit(NEW.sender_id, 'send_orbit_message', 60, 60);
    END IF;

    IF char_length(btrim(coalesce(NEW.body, ''))) = 0 AND NEW.attachment_path IS NULL THEN
      RAISE EXCEPTION 'Orbit message cannot be empty.' USING ERRCODE = '22023';
    END IF;

    IF v_is_ann THEN
      v_role := public.get_orbit_role(NEW.orbit_id, NEW.sender_id);
      IF v_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Only Orbit owners and administrators can post in announcement channels.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_orbit_msg_insert ON public.orbit_messages;
CREATE TRIGGER trg_before_orbit_msg_insert
BEFORE INSERT ON public.orbit_messages
FOR EACH ROW EXECUTE FUNCTION public.before_orbit_message_insert_guard();

CREATE OR REPLACE FUNCTION public.after_orbit_message_insert_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_preview text;
BEGIN
  IF char_length(btrim(NEW.body)) > 0 THEN
    v_preview := left(regexp_replace(btrim(NEW.body), '\s+', ' ', 'g'), 140);
  ELSIF NEW.attachment_path IS NOT NULL THEN
    v_preview := 'Shared an attachment';
  ELSE
    v_preview := '';
  END IF;

  UPDATE public.orbit_channels
     SET last_message_preview = v_preview,
         last_message_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.channel_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_orbit_msg_insert ON public.orbit_messages;
CREATE TRIGGER trg_after_orbit_msg_insert
AFTER INSERT ON public.orbit_messages
FOR EACH ROW EXECUTE FUNCTION public.after_orbit_message_insert_sync();

CREATE OR REPLACE FUNCTION public.before_orbit_message_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF pg_trigger_depth() > 1
     AND NEW.id = OLD.id
     AND NEW.channel_id = OLD.channel_id
     AND (NEW.sender_id IS NOT DISTINCT FROM OLD.sender_id OR NEW.sender_id IS NULL) THEN
    RETURN NEW;
  END IF;

  IF NEW.id <> OLD.id
     OR NEW.orbit_id <> OLD.orbit_id
     OR NEW.channel_id <> OLD.channel_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.kind <> OLD.kind THEN
    RAISE EXCEPTION 'Immutable Orbit message fields cannot be altered.' USING ERRCODE = '42501';
  END IF;

  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Deleted Orbit messages cannot be edited.' USING ERRCODE = '42501';
  END IF;

  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.body := '';
    NEW.attachment_path := NULL;
    NEW.attachment_name := NULL;
    NEW.attachment_mime := NULL;
    NEW.attachment_size := NULL;
    NEW.edited_at := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.body IS DISTINCT FROM OLD.body THEN
    IF char_length(btrim(NEW.body)) = 0 AND NEW.attachment_path IS NULL THEN
      RAISE EXCEPTION 'Edited message cannot be empty.' USING ERRCODE = '22023';
    END IF;
    NEW.edited_at := now();
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_orbit_msg_update ON public.orbit_messages;
CREATE TRIGGER trg_before_orbit_msg_update
BEFORE UPDATE ON public.orbit_messages
FOR EACH ROW EXECUTE FUNCTION public.before_orbit_message_update_guard();

-- Rate-limit & guard Posts, Comments, and Moments
CREATE OR REPLACE FUNCTION public.before_post_insert_or_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.check_rate_limit(NEW.author_id, 'create_post', 20, 300);
    RETURN NEW;
  END IF;

  IF NEW.id <> OLD.id OR NEW.author_id <> OLD.author_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Immutable post fields cannot be altered.' USING ERRCODE = '42501';
  END IF;

  IF coalesce(current_setting('asterial.trusted_rpc', true), '') <> '1'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF NEW.like_count <> OLD.like_count OR NEW.comment_count <> OLD.comment_count THEN
      RAISE EXCEPTION 'Post engagement counters are server-managed.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.body := '';
    NEW.media_path := NULL;
    NEW.media_mime := NULL;
    NEW.media_name := NULL;
    NEW.media_size := NULL;
    NEW.edited_at := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF NEW.body IS DISTINCT FROM OLD.body THEN
    IF char_length(btrim(NEW.body)) = 0 AND NEW.media_path IS NULL THEN
      RAISE EXCEPTION 'Post cannot be empty.' USING ERRCODE = '22023';
    END IF;
    NEW.edited_at := now();
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_post_write ON public.posts;
CREATE TRIGGER trg_before_post_write
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.before_post_insert_or_update_guard();

-- Exact transactional counters for post_likes & post_comments (zero stale counts)
CREATE OR REPLACE FUNCTION public.sync_post_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_post_id uuid := coalesce(NEW.post_id, OLD.post_id);
BEGIN
  PERFORM set_config('asterial.trusted_rpc', '1', true);
  UPDATE public.posts p
     SET like_count = (
       SELECT count(*)::integer FROM public.post_likes pl WHERE pl.post_id = v_post_id
     )
   WHERE p.id = v_post_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_post_like_count ON public.post_likes;
CREATE TRIGGER trg_sync_post_like_count
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_post_like_count();

CREATE OR REPLACE FUNCTION public.sync_post_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_post_id uuid := coalesce(NEW.post_id, OLD.post_id);
BEGIN
  PERFORM set_config('asterial.trusted_rpc', '1', true);
  UPDATE public.posts p
     SET comment_count = (
       SELECT count(*)::integer
         FROM public.post_comments pc
        WHERE pc.post_id = v_post_id
          AND pc.deleted_at IS NULL
     )
   WHERE p.id = v_post_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_post_comment_count ON public.post_comments;
CREATE TRIGGER trg_sync_post_comment_count
AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_post_comment_count();

CREATE OR REPLACE FUNCTION public.before_moment_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.check_rate_limit(NEW.author_id, 'create_moment', 20, 300);
    NEW.expires_at := NEW.created_at + make_interval(hours => NEW.duration_hours);
    RETURN NEW;
  END IF;

  IF NEW.id <> OLD.id OR NEW.author_id <> OLD.author_id THEN
    RAISE EXCEPTION 'Immutable Moment fields cannot be altered.' USING ERRCODE = '42501';
  END IF;

  IF coalesce(current_setting('asterial.trusted_rpc', true), '') <> '1'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND NEW.view_count <> OLD.view_count THEN
    RAISE EXCEPTION 'Moment view_count is server-managed.' USING ERRCODE = '42501';
  END IF;

  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.caption := '';
    NEW.media_path := NULL;
    NEW.media_mime := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_moment_write ON public.moments;
CREATE TRIGGER trg_before_moment_write
BEFORE INSERT OR UPDATE ON public.moments
FOR EACH ROW EXECUTE FUNCTION public.before_moment_write_guard();

CREATE OR REPLACE FUNCTION public.sync_moment_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_moment_id uuid := coalesce(NEW.moment_id, OLD.moment_id);
BEGIN
  PERFORM set_config('asterial.trusted_rpc', '1', true);
  UPDATE public.moments m
     SET view_count = (
       SELECT count(*)::integer FROM public.moment_views mv WHERE mv.moment_id = v_moment_id
     )
   WHERE m.id = v_moment_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_moment_view_count ON public.moment_views;
CREATE TRIGGER trg_sync_moment_view_count
AFTER INSERT OR DELETE ON public.moment_views
FOR EACH ROW EXECUTE FUNCTION public.sync_moment_view_count();

-- ============================================================================
-- 6. ROW LEVEL SECURITY POLICIES FOR ALL NEW TABLES
-- ============================================================================
ALTER TABLE public.orbits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbit_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbit_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orbit_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moment_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Orbits: visible if public or caller is active/invited member; writes via server RPCs
DROP POLICY IF EXISTS orbits_select_authorized ON public.orbits;
CREATE POLICY orbits_select_authorized
  ON public.orbits FOR SELECT TO authenticated
  USING (public.can_view_orbit(id, auth.uid()));

-- Orbit Members: visible to Orbit members or public Orbit browsers
DROP POLICY IF EXISTS orbit_members_select_authorized ON public.orbit_members;
CREATE POLICY orbit_members_select_authorized
  ON public.orbit_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_view_orbit(orbit_id, auth.uid())
  );

-- Orbit Channels: strictly gated to active Orbit members
DROP POLICY IF EXISTS orbit_channels_select_member ON public.orbit_channels;
CREATE POLICY orbit_channels_select_member
  ON public.orbit_channels FOR SELECT TO authenticated
  USING (public.is_orbit_member(orbit_id, auth.uid()));

-- Orbit Messages: strictly gated to active Orbit members
DROP POLICY IF EXISTS orbit_messages_select_member ON public.orbit_messages;
CREATE POLICY orbit_messages_select_member
  ON public.orbit_messages FOR SELECT TO authenticated
  USING (public.is_orbit_member(orbit_id, auth.uid()));

DROP POLICY IF EXISTS orbit_messages_insert_member ON public.orbit_messages;
CREATE POLICY orbit_messages_insert_member
  ON public.orbit_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND kind = 'user'
    AND deleted_at IS NULL
    AND public.is_orbit_member(orbit_id, auth.uid())
  );

DROP POLICY IF EXISTS orbit_messages_update_author ON public.orbit_messages;
CREATE POLICY orbit_messages_update_author
  ON public.orbit_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() AND public.is_orbit_member(orbit_id, auth.uid()))
  WITH CHECK (sender_id = auth.uid());

-- Moments: strictly unexpired + non-deleted + audience & block enforced
DROP POLICY IF EXISTS moments_select_authorized ON public.moments;
CREATE POLICY moments_select_authorized
  ON public.moments FOR SELECT TO authenticated
  USING (public.can_view_moment(id, auth.uid()));

DROP POLICY IF EXISTS moments_insert_own ON public.moments;
CREATE POLICY moments_insert_own
  ON public.moments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS moments_update_own ON public.moments;
CREATE POLICY moments_update_own
  ON public.moments FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Moment Views: author can inspect viewers of their own Moment; viewer can see own view record
DROP POLICY IF EXISTS moment_views_select_authorized ON public.moment_views;
CREATE POLICY moment_views_select_authorized
  ON public.moment_views FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.moments m
       WHERE m.id = moment_views.moment_id
         AND m.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS moment_views_insert_own ON public.moment_views;
CREATE POLICY moment_views_insert_own
  ON public.moment_views FOR INSERT TO authenticated
  WITH CHECK (
    viewer_id = auth.uid()
    AND public.can_view_moment(moment_id, auth.uid())
  );

-- Posts: strictly non-deleted + visibility & block enforced
DROP POLICY IF EXISTS posts_select_authorized ON public.posts;
CREATE POLICY posts_select_authorized
  ON public.posts FOR SELECT TO authenticated
  USING (public.can_view_post(id, auth.uid()));

DROP POLICY IF EXISTS posts_insert_own ON public.posts;
CREATE POLICY posts_insert_own
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS posts_update_own ON public.posts;
CREATE POLICY posts_update_own
  ON public.posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Post Likes
DROP POLICY IF EXISTS post_likes_select_authorized ON public.post_likes;
CREATE POLICY post_likes_select_authorized
  ON public.post_likes FOR SELECT TO authenticated
  USING (public.can_view_post(post_id, auth.uid()));

DROP POLICY IF EXISTS post_likes_insert_own ON public.post_likes;
CREATE POLICY post_likes_insert_own
  ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_view_post(post_id, auth.uid())
  );

DROP POLICY IF EXISTS post_likes_delete_own ON public.post_likes;
CREATE POLICY post_likes_delete_own
  ON public.post_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Post Comments
DROP POLICY IF EXISTS post_comments_select_authorized ON public.post_comments;
CREATE POLICY post_comments_select_authorized
  ON public.post_comments FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.can_view_post(post_id, auth.uid())
    AND NOT public.is_blocked_between(auth.uid(), author_id)
  );

DROP POLICY IF EXISTS post_comments_insert_own ON public.post_comments;
CREATE POLICY post_comments_insert_own
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND deleted_at IS NULL
    AND public.can_view_post(post_id, auth.uid())
  );

DROP POLICY IF EXISTS post_comments_update_own_or_post_author ON public.post_comments;
CREATE POLICY post_comments_update_own_or_post_author
  ON public.post_comments FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.posts p
       WHERE p.id = post_comments.post_id
         AND p.author_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- ============================================================================
-- 7. PRIVATE STORAGE BUCKET `social-media` & STRICT OBJECT POLICIES
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media',
  'social-media',
  false,
  15728640,
  ARRAY[
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
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY[
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
    ];

DROP POLICY IF EXISTS social_media_select_authorized ON storage.objects;
CREATE POLICY social_media_select_authorized
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'social-media'
    AND public.can_read_social_media_object(name, auth.uid())
  );

DROP POLICY IF EXISTS social_media_insert_own ON storage.objects;
CREATE POLICY social_media_insert_own
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[1] IN ('posts', 'moments', 'orbits')
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS social_media_delete_own ON storage.objects;
CREATE POLICY social_media_delete_own
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ============================================================================
-- 8. ATOMIC SERVER-ENFORCED RPC WORKFLOWS (ORBITS, MOMENTS, FEED)
-- ============================================================================

-- 8A. Create Orbit (provisions owner role + #general + #announcements channels)
CREATE OR REPLACE FUNCTION public.create_orbit(
  p_name text,
  p_slug text,
  p_description text DEFAULT '',
  p_visibility text DEFAULT 'public',
  p_icon_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(regexp_replace(btrim(coalesce(p_slug, '')), '[^a-z0-9-]+', '-', 'g'));
  v_vis text := lower(btrim(coalesce(p_visibility, 'public')));
  v_orbit_id uuid;
  v_general_id uuid;
  v_actor_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_rate_limit(v_uid, 'create_orbit', 10, 300);

  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  IF char_length(v_name) < 2 OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'Orbit name must be between 2 and 80 characters.' USING ERRCODE = '22023';
  END IF;

  IF v_slug !~ '^[a-z0-9][a-z0-9-]{1,34}[a-z0-9]$' THEN
    RAISE EXCEPTION 'Orbit handle must be 3–36 lowercase letters, numbers, or hyphens.' USING ERRCODE = '22023';
  END IF;

  IF v_vis NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'Orbit visibility must be public or private.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.orbits WHERE lower(slug) = v_slug) THEN
    RAISE EXCEPTION 'An Orbit with handle "%s" already exists.', v_slug USING ERRCODE = '23505';
  END IF;

  PERFORM set_config('asterial.trusted_rpc', '1', true);

  INSERT INTO public.orbits (slug, name, description, icon_url, visibility, created_by, member_count)
  VALUES (v_slug, v_name, left(coalesce(p_description, ''), 500), p_icon_url, v_vis, v_uid, 1)
  RETURNING id INTO v_orbit_id;

  INSERT INTO public.orbit_members (orbit_id, user_id, role, status)
  VALUES (v_orbit_id, v_uid, 'owner', 'active');

  INSERT INTO public.orbit_channels (orbit_id, slug, name, topic, is_announcement, sort_order)
  VALUES
    (v_orbit_id, 'announcements', 'announcements', 'Official updates from Orbit owners & administrators', true, 0);

  INSERT INTO public.orbit_channels (orbit_id, slug, name, topic, is_announcement, sort_order)
  VALUES
    (v_orbit_id, 'general', 'general', 'Main community conversation for ' || v_name, false, 1)
  RETURNING id INTO v_general_id;

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = v_uid;
  INSERT INTO public.orbit_messages (orbit_id, channel_id, sender_id, kind, body)
  VALUES (
    v_orbit_id,
    v_general_id,
    v_uid,
    'system',
    coalesce(v_actor_name, 'Founder') || ' launched Orbit "' || v_name || '"'
  );

  RETURN v_orbit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_orbit(text, text, text, text, text) TO authenticated;

-- 8B. Update or Soft-Delete Orbit
CREATE OR REPLACE FUNCTION public.update_orbit_details(
  p_orbit_id uuid,
  p_name text,
  p_description text DEFAULT '',
  p_visibility text DEFAULT 'public',
  p_icon_url text DEFAULT NULL,
  p_soft_delete boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_clean_name text := btrim(coalesce(p_name, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_role := public.get_orbit_role(p_orbit_id, v_uid);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only Orbit owners and administrators can manage Orbit settings.' USING ERRCODE = '42501';
  END IF;

  IF p_soft_delete THEN
    IF v_role <> 'owner' THEN
      RAISE EXCEPTION 'Only the Orbit owner can delete an Orbit.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.orbits
       SET deleted_at = now(),
           updated_at = now()
     WHERE id = p_orbit_id;
    RETURN;
  END IF;

  IF char_length(v_clean_name) < 2 OR char_length(v_clean_name) > 80 THEN
    RAISE EXCEPTION 'Orbit name must be between 2 and 80 characters.' USING ERRCODE = '22023';
  END IF;

  IF p_visibility NOT IN ('public', 'private') THEN
    RAISE EXCEPTION 'Orbit visibility must be public or private.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orbits
     SET name = v_clean_name,
         description = left(coalesce(p_description, ''), 500),
         visibility = p_visibility,
         icon_url = coalesce(p_icon_url, icon_url),
         updated_at = now()
   WHERE id = p_orbit_id
     AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_orbit_details(uuid, text, text, text, text, boolean) TO authenticated;

-- 8C. Join Orbit (enforces public/invite rules & ban list)
CREATE OR REPLACE FUNCTION public.join_orbit(p_orbit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_vis text;
  v_deleted timestamptz;
  v_existing_status text;
  v_general_id uuid;
  v_actor_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_rate_limit(v_uid, 'join_orbit', 30, 300);

  SELECT visibility, deleted_at INTO v_vis, v_deleted
    FROM public.orbits
   WHERE id = p_orbit_id;

  IF v_vis IS NULL OR v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'This Orbit is unavailable or has been removed.' USING ERRCODE = 'P0002';
  END IF;

  SELECT status INTO v_existing_status
    FROM public.orbit_members
   WHERE orbit_id = p_orbit_id
     AND user_id = v_uid;

  IF v_existing_status = 'banned' THEN
    RAISE EXCEPTION 'You are banned from joining this Orbit.' USING ERRCODE = '42501';
  END IF;

  IF v_existing_status = 'active' THEN
    RETURN;
  END IF;

  IF v_vis = 'private' AND v_existing_status IS DISTINCT FROM 'invited' THEN
    RAISE EXCEPTION 'This Orbit is private and requires an invitation from an administrator.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('asterial.trusted_rpc', '1', true);

  INSERT INTO public.orbit_members (orbit_id, user_id, role, status, joined_at)
  VALUES (p_orbit_id, v_uid, 'member', 'active', now())
  ON CONFLICT (orbit_id, user_id) DO UPDATE
    SET status = 'active',
        role = CASE WHEN public.orbit_members.role IN ('owner', 'admin') THEN public.orbit_members.role ELSE 'member' END,
        joined_at = now(),
        updated_at = now();

  SELECT id INTO v_general_id
    FROM public.orbit_channels
   WHERE orbit_id = p_orbit_id
   ORDER BY is_announcement ASC, sort_order ASC
   LIMIT 1;

  IF v_general_id IS NOT NULL THEN
    SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = v_uid;
    INSERT INTO public.orbit_messages (orbit_id, channel_id, sender_id, kind, body)
    VALUES (p_orbit_id, v_general_id, v_uid, 'system', coalesce(v_actor_name, 'Member') || ' joined the Orbit');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_orbit(uuid) TO authenticated;

-- 8D. Leave Orbit (transfers ownership automatically if owner leaves)
CREATE OR REPLACE FUNCTION public.leave_orbit(p_orbit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_successor uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_role := public.get_orbit_role(p_orbit_id, v_uid);
  IF v_role IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.orbit_members
     SET status = 'left',
         role = 'member',
         updated_at = now()
   WHERE orbit_id = p_orbit_id
     AND user_id = v_uid;

  IF v_role = 'owner' THEN
    SELECT om.user_id INTO v_successor
      FROM public.orbit_members om
     WHERE om.orbit_id = p_orbit_id
       AND om.status = 'active'
     ORDER BY (om.role = 'admin') DESC, om.joined_at ASC
     LIMIT 1;

    IF v_successor IS NOT NULL THEN
      UPDATE public.orbit_members
         SET role = 'owner',
             updated_at = now()
       WHERE orbit_id = p_orbit_id
         AND user_id = v_successor;
    ELSE
      UPDATE public.orbits
         SET deleted_at = now(),
             updated_at = now()
       WHERE id = p_orbit_id;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_orbit(uuid) TO authenticated;

-- 8E. Invite / Add Member to Orbit (owner/admin)
CREATE OR REPLACE FUNCTION public.invite_orbit_member(
  p_orbit_id uuid,
  p_target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_existing_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_role := public.get_orbit_role(p_orbit_id, v_uid);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only Orbit owners and administrators can invite members.' USING ERRCODE = '42501';
  END IF;

  IF public.is_blocked_between(v_uid, p_target_user_id) THEN
    RAISE EXCEPTION 'Cannot add this user due to block settings.' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_existing_status
    FROM public.orbit_members
   WHERE orbit_id = p_orbit_id
     AND user_id = p_target_user_id;

  IF v_existing_status = 'active' THEN
    RETURN;
  END IF;

  INSERT INTO public.orbit_members (orbit_id, user_id, role, status, joined_at)
  VALUES (p_orbit_id, p_target_user_id, 'member', 'active', now())
  ON CONFLICT (orbit_id, user_id) DO UPDATE
    SET status = 'active',
        role = 'member',
        joined_at = now(),
        updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_orbit_member(uuid, uuid) TO authenticated;

-- 8F. Moderate Orbit Member (kick, ban, unban, set_role)
CREATE OR REPLACE FUNCTION public.moderate_orbit_member(
  p_orbit_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_new_role text DEFAULT 'member'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id = v_uid THEN
    RAISE EXCEPTION 'Use leave_orbit to leave an Orbit.' USING ERRCODE = '22023';
  END IF;

  v_actor_role := public.get_orbit_role(p_orbit_id, v_uid);
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Moderation permission denied.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_target_role
    FROM public.orbit_members
   WHERE orbit_id = p_orbit_id
     AND user_id = p_target_user_id;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'The Orbit owner cannot be removed or demoted.' USING ERRCODE = '42501';
  END IF;

  IF v_actor_role = 'admin' AND v_target_role = 'admin' THEN
    RAISE EXCEPTION 'Only the Orbit owner can moderate another administrator.' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'kick' THEN
    UPDATE public.orbit_members
       SET status = 'left', role = 'member', updated_at = now()
     WHERE orbit_id = p_orbit_id AND user_id = p_target_user_id;
  ELSIF p_action = 'ban' THEN
    UPDATE public.orbit_members
       SET status = 'banned', role = 'member', updated_at = now()
     WHERE orbit_id = p_orbit_id AND user_id = p_target_user_id;
  ELSIF p_action = 'unban' THEN
    UPDATE public.orbit_members
       SET status = 'left', role = 'member', updated_at = now()
     WHERE orbit_id = p_orbit_id AND user_id = p_target_user_id AND status = 'banned';
  ELSIF p_action = 'set_role' THEN
    IF v_actor_role <> 'owner' THEN
      RAISE EXCEPTION 'Only the Orbit owner can change member roles.' USING ERRCODE = '42501';
    END IF;
    IF p_new_role NOT IN ('admin', 'member') THEN
      RAISE EXCEPTION 'Target role must be admin or member.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.orbit_members
       SET role = p_new_role, updated_at = now()
     WHERE orbit_id = p_orbit_id AND user_id = p_target_user_id AND status = 'active';
  ELSE
    RAISE EXCEPTION 'Unsupported moderation action.' USING ERRCODE = '22023';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_orbit_member(uuid, uuid, text, text) TO authenticated;

-- 8G. Create Orbit Channel (owner/admin)
CREATE OR REPLACE FUNCTION public.create_orbit_channel(
  p_orbit_id uuid,
  p_name text,
  p_topic text DEFAULT '',
  p_is_announcement boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_slug text;
  v_next_sort integer;
  v_chan_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_role := public.get_orbit_role(p_orbit_id, v_uid);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only Orbit owners and administrators can create channels.' USING ERRCODE = '42501';
  END IF;

  v_slug := lower(regexp_replace(btrim(coalesce(p_name, '')), '[^a-z0-9-]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

  IF v_slug !~ '^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$' THEN
    RAISE EXCEPTION 'Channel name must contain at least 2 alphanumeric characters.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(max(sort_order), 0) + 1 INTO v_next_sort
    FROM public.orbit_channels
   WHERE orbit_id = p_orbit_id;

  INSERT INTO public.orbit_channels (orbit_id, slug, name, topic, is_announcement, sort_order)
  VALUES (
    p_orbit_id,
    v_slug,
    left(btrim(p_name), 50),
    left(coalesce(p_topic, ''), 240),
    coalesce(p_is_announcement, false),
    v_next_sort
  )
  RETURNING id INTO v_chan_id;

  RETURN v_chan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_orbit_channel(uuid, text, text, boolean) TO authenticated;

-- 8H. Moderate / Author Soft-Delete Orbit Message
CREATE OR REPLACE FUNCTION public.delete_orbit_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_orbit_id uuid;
  v_sender uuid;
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT orbit_id, sender_id INTO v_orbit_id, v_sender
    FROM public.orbit_messages
   WHERE id = p_message_id
     AND deleted_at IS NULL;

  IF v_orbit_id IS NULL THEN
    RETURN;
  END IF;

  v_role := public.get_orbit_role(v_orbit_id, v_uid);
  IF v_sender IS DISTINCT FROM v_uid AND coalesce(v_role, '') NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only the message author or an Orbit moderator can delete this message.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.orbit_messages
     SET deleted_at = now(),
         deleted_by = v_uid
   WHERE id = p_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_orbit_message(uuid) TO authenticated;

-- 8I. Cursor-Paginated Orbit Messages RPC
CREATE OR REPLACE FUNCTION public.get_orbit_messages_page(
  p_channel_id uuid,
  p_before_created_at timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 40
)
RETURNS SETOF public.orbit_messages
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_orbit_id uuid;
  v_lim integer := LEAST(GREATEST(coalesce(p_limit, 40), 1), 100);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT orbit_id INTO v_orbit_id FROM public.orbit_channels WHERE id = p_channel_id;
  IF v_orbit_id IS NULL OR NOT public.is_orbit_member(v_orbit_id, v_uid) THEN
    RAISE EXCEPTION 'Orbit channel access denied.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT m.*
    FROM public.orbit_messages m
   WHERE m.channel_id = p_channel_id
     AND (
       p_before_created_at IS NULL
       OR m.created_at < p_before_created_at
       OR (m.created_at = p_before_created_at AND (p_before_id IS NULL OR m.id < p_before_id))
     )
   ORDER BY m.created_at DESC, m.id DESC
   LIMIT v_lim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_orbit_messages_page(uuid, timestamptz, uuid, integer) TO authenticated;

-- 8J. Toggle Post Like Atomically (returns server-reconciled liked + like_count)
CREATE OR REPLACE FUNCTION public.toggle_post_like(p_post_id uuid)
RETURNS TABLE (liked boolean, like_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_liked boolean;
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_rate_limit(v_uid, 'toggle_post_like', 90, 60);

  IF NOT public.can_view_post(p_post_id, v_uid) THEN
    RAISE EXCEPTION 'Post is unavailable or private.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.post_likes pl WHERE pl.post_id = p_post_id AND pl.user_id = v_uid) THEN
    DELETE FROM public.post_likes pl WHERE pl.post_id = p_post_id AND pl.user_id = v_uid;
    v_liked := false;
  ELSE
    INSERT INTO public.post_likes (post_id, user_id)
    VALUES (p_post_id, v_uid)
    ON CONFLICT (post_id, user_id) DO NOTHING;
    v_liked := true;
  END IF;

  SELECT p.like_count INTO v_count FROM public.posts p WHERE p.id = p_post_id;
  RETURN QUERY SELECT v_liked, coalesce(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_post_like(uuid) TO authenticated;

-- 8K. Predictable Chronological Social Feed Page RPC (created_at DESC, id DESC)
CREATE OR REPLACE FUNCTION public.get_feed_posts_page(
  p_before_created_at timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL,
  p_author_id uuid DEFAULT NULL,
  p_scope text DEFAULT 'all',
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  body text,
  visibility text,
  media_path text,
  media_mime text,
  media_name text,
  media_size bigint,
  media_width integer,
  media_height integer,
  like_count integer,
  comment_count integer,
  viewer_has_liked boolean,
  edited_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lim integer := LEAST(GREATEST(coalesce(p_limit, 20), 1), 50);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.author_id,
    pr.username AS author_username,
    pr.display_name AS author_display_name,
    pr.avatar_url AS author_avatar_url,
    p.body,
    p.visibility,
    p.media_path,
    p.media_mime,
    p.media_name,
    p.media_size,
    p.media_width,
    p.media_height,
    p.like_count,
    p.comment_count,
    EXISTS (
      SELECT 1 FROM public.post_likes pl
       WHERE pl.post_id = p.id AND pl.user_id = v_uid
    ) AS viewer_has_liked,
    p.edited_at,
    p.created_at,
    p.updated_at
  FROM public.posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.deleted_at IS NULL
    AND (p_author_id IS NULL OR p.author_id = p_author_id)
    AND public.can_view_post(p.id, v_uid)
    AND (
      p_scope <> 'contacts'
      OR p.author_id = v_uid
      OR public.has_shared_direct_conversation(v_uid, p.author_id)
    )
    AND (
      p_before_created_at IS NULL
      OR p.created_at < p_before_created_at
      OR (p.created_at = p_before_created_at AND (p_before_id IS NULL OR p.id < p.before_id))
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT v_lim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_feed_posts_page(timestamptz, uuid, uuid, text, integer) TO authenticated;

-- 8L. Active Moments Feed RPC (strictly unexpired, non-blocked, audience-enforced)
CREATE OR REPLACE FUNCTION public.get_active_moments(p_limit integer DEFAULT 40)
RETURNS TABLE (
  id uuid,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  caption text,
  background_tone text,
  media_path text,
  media_mime text,
  media_width integer,
  media_height integer,
  audience text,
  duration_hours integer,
  view_count integer,
  viewer_has_viewed boolean,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lim integer := LEAST(GREATEST(coalesce(p_limit, 40), 1), 100);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.author_id,
    pr.username AS author_username,
    pr.display_name AS author_display_name,
    pr.avatar_url AS author_avatar_url,
    m.caption,
    m.background_tone,
    m.media_path,
    m.media_mime,
    m.media_width,
    m.media_height,
    m.audience,
    m.duration_hours,
    m.view_count,
    EXISTS (
      SELECT 1 FROM public.moment_views mv
       WHERE mv.moment_id = m.id AND mv.viewer_id = v_uid
    ) AS viewer_has_viewed,
    m.created_at,
    m.expires_at
  FROM public.moments m
  JOIN public.profiles pr ON pr.id = m.author_id
  WHERE m.deleted_at IS NULL
    AND m.expires_at > now()
    AND public.can_view_moment(m.id, v_uid)
  ORDER BY (m.author_id = v_uid) DESC, m.created_at DESC
  LIMIT v_lim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_moments(integer) TO authenticated;

-- 8M. Record Moment View (non-author idempotent view tracking)
CREATE OR REPLACE FUNCTION public.record_moment_view(p_moment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_author uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.can_view_moment(p_moment_id, v_uid) THEN
    RETURN;
  END IF;

  SELECT author_id INTO v_author FROM public.moments WHERE id = p_moment_id;
  IF v_author IS NULL OR v_author = v_uid THEN
    RETURN;
  END IF;

  INSERT INTO public.moment_views (moment_id, viewer_id)
  VALUES (p_moment_id, v_uid)
  ON CONFLICT (moment_id, viewer_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_moment_view(uuid) TO authenticated;

-- 8N. Update delete_own_account() to transfer Orbit ownership cleanly too
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('asterial.trusted_rpc', '1', true);

  -- Transfer ownership of any groups owned by this user
  UPDATE public.conversation_members cm_target
     SET role = 'owner'
    FROM (
      SELECT DISTINCT ON (cm_own.conversation_id)
        cm_own.conversation_id,
        cm_next.user_id AS next_owner_id
      FROM public.conversation_members cm_own
      JOIN public.conversation_members cm_next
        ON cm_next.conversation_id = cm_own.conversation_id
       AND cm_next.user_id <> v_uid
       AND cm_next.left_at IS NULL
      WHERE cm_own.user_id = v_uid
        AND cm_own.role = 'owner'
        AND cm_own.left_at IS NULL
      ORDER BY cm_own.conversation_id, (cm_next.role = 'admin') DESC, cm_next.joined_at ASC
    ) transfers
   WHERE cm_target.conversation_id = transfers.conversation_id
     AND cm_target.user_id = transfers.next_owner_id;

  -- Transfer ownership of any Orbits owned by this user
  UPDATE public.orbit_members om_target
     SET role = 'owner', updated_at = now()
    FROM (
      SELECT DISTINCT ON (om_own.orbit_id)
        om_own.orbit_id,
        om_next.user_id AS next_owner_id
      FROM public.orbit_members om_own
      JOIN public.orbit_members om_next
        ON om_next.orbit_id = om_own.orbit_id
       AND om_next.user_id <> v_uid
       AND om_next.status = 'active'
      WHERE om_own.user_id = v_uid
        AND om_own.role = 'owner'
        AND om_own.status = 'active'
      ORDER BY om_own.orbit_id, (om_next.role = 'admin') DESC, om_next.joined_at ASC
    ) orbit_transfers
   WHERE om_target.orbit_id = orbit_transfers.orbit_id
     AND om_target.user_id = orbit_transfers.next_owner_id;

  -- Soft-delete Orbits where this user was the sole active member
  UPDATE public.orbits o
     SET deleted_at = coalesce(o.deleted_at, now())
   WHERE o.deleted_at IS NULL
     AND EXISTS (
       SELECT 1 FROM public.orbit_members om
        WHERE om.orbit_id = o.id AND om.user_id = v_uid AND om.role = 'owner' AND om.status = 'active'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.orbit_members om_other
        WHERE om_other.orbit_id = o.id AND om_other.user_id <> v_uid AND om_other.status = 'active'
     );

  -- Soft-wipe message bodies sent by this user before auth cascade sets sender_id = NULL
  UPDATE public.messages
     SET body = '',
         has_attachments = false,
         deleted_at = coalesce(deleted_at, now()),
         updated_at = now()
   WHERE sender_id = v_uid
     AND kind = 'user'
     AND deleted_at IS NULL;

  UPDATE public.orbit_messages
     SET body = '',
         deleted_at = coalesce(deleted_at, now()),
         deleted_by = v_uid
   WHERE sender_id = v_uid
     AND kind = 'user'
     AND deleted_at IS NULL;

  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- ============================================================================
-- 9. ENABLE REALTIME PUBLICATION FOR ORBITS, MOMENTS & FEED TABLES
-- ============================================================================
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'orbits',
    'orbit_members',
    'orbit_channels',
    'orbit_messages',
    'moments',
    'posts',
    'post_likes',
    'post_comments'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- ROLLBACK NOTES (Reversible without touching Phase 1 / Phase 2 tables):
--   DROP FUNCTION IF EXISTS public.record_moment_view(uuid);
--   DROP FUNCTION IF EXISTS public.get_active_moments(integer);
--   DROP FUNCTION IF EXISTS public.get_feed_posts_page(timestamptz, uuid, uuid, text, integer);
--   DROP FUNCTION IF EXISTS public.toggle_post_like(uuid);
--   DROP FUNCTION IF EXISTS public.get_orbit_messages_page(uuid, timestamptz, uuid, integer);
--   DROP FUNCTION IF EXISTS public.delete_orbit_message(uuid);
--   DROP FUNCTION IF EXISTS public.create_orbit_channel(uuid, text, text, boolean);
--   DROP FUNCTION IF EXISTS public.moderate_orbit_member(uuid, uuid, text, text);
--   DROP FUNCTION IF EXISTS public.invite_orbit_member(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.leave_orbit(uuid);
--   DROP FUNCTION IF EXISTS public.join_orbit(uuid);
--   DROP FUNCTION IF EXISTS public.update_orbit_details(uuid, text, text, text, text, boolean);
--   DROP FUNCTION IF EXISTS public.create_orbit(text, text, text, text, text);
--   DROP TABLE IF EXISTS public.post_comments, public.post_likes, public.posts,
--     public.moment_views, public.moments,
--     public.orbit_messages, public.orbit_channels, public.orbit_members, public.orbits;
-- ============================================================================
