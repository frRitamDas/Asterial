-- ============================================================================
-- ASTERIAL v1.4.5 — Full-Stack Reconstruction Migration
-- Additive, non-destructive schema & security expansion:
--   1. Personal Close-Connections Orbits (public.close_orbits) with strict owner RLS
--   2. Message Pinning & Forwarding (pinned_at, pinned_by, forwarded_from_id + RPCs)
--   3. Video & Voice Media Support across Chats, Orbits, Moments & Social Feed (up to 25 MB)
--   4. Close-Orbit ('orbit') Audience Support on Moments & Feed Posts
--   5. Threaded Replies on Community Feed Comments (parent_comment_id)
--   6. Unified Authorized Search RPCs for Moments & Feed Posts
--   7. System Theme, Selective Accent Color & Chat Wallpaper Preferences
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PERSONAL CLOSE-CONNECTIONS ORBITS (Section 10)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.close_orbits (
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'inner',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, contact_id),
  CONSTRAINT close_orbits_not_self CHECK (owner_id <> contact_id),
  CONSTRAINT close_orbits_tier_chk CHECK (tier IN ('inner', 'priority')),
  CONSTRAINT close_orbits_note_len_chk CHECK (char_length(note) <= 160)
);

CREATE INDEX IF NOT EXISTS idx_close_orbits_owner_tier
  ON public.close_orbits (owner_id, tier, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_close_orbits_contact
  ON public.close_orbits (contact_id);

DROP TRIGGER IF EXISTS trg_close_orbits_updated_at ON public.close_orbits;
CREATE TRIGGER trg_close_orbits_updated_at
  BEFORE UPDATE ON public.close_orbits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.close_orbits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS close_orbits_select_own ON public.close_orbits;
CREATE POLICY close_orbits_select_own
  ON public.close_orbits
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS close_orbits_insert_own ON public.close_orbits;
CREATE POLICY close_orbits_insert_own
  ON public.close_orbits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND owner_id <> contact_id
    AND NOT public.is_blocked_between(auth.uid(), contact_id)
  );

DROP POLICY IF EXISTS close_orbits_update_own ON public.close_orbits;
CREATE POLICY close_orbits_update_own
  ON public.close_orbits
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS close_orbits_delete_own ON public.close_orbits;
CREATE POLICY close_orbits_delete_own
  ON public.close_orbits
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_in_author_close_orbit(
  p_author_id uuid,
  p_viewer_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.close_orbits co
     WHERE co.owner_id = p_author_id
       AND co.contact_id = p_viewer_id
  );
$$;

CREATE OR REPLACE FUNCTION public.upsert_close_orbit_contact(
  p_contact_id uuid,
  p_tier text DEFAULT 'inner',
  p_note text DEFAULT ''
)
RETURNS public.close_orbits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tier text := lower(btrim(coalesce(p_tier, 'inner')));
  v_note text := left(btrim(coalesce(p_note, '')), 160);
  v_row public.close_orbits;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_contact_id IS NULL OR p_contact_id = v_uid THEN
    RAISE EXCEPTION 'Cannot add yourself to Close Orbit.' USING ERRCODE = '22023';
  END IF;

  IF v_tier NOT IN ('inner', 'priority') THEN
    RAISE EXCEPTION 'Invalid Orbit tier.' USING ERRCODE = '22023';
  END IF;

  IF public.is_blocked_between(v_uid, p_contact_id) THEN
    RAISE EXCEPTION 'Cannot add a blocked contact to Close Orbit.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_rate_limit(v_uid, 'upsert_close_orbit', 40, 60);

  INSERT INTO public.close_orbits (owner_id, contact_id, tier, note)
  VALUES (v_uid, p_contact_id, v_tier, v_note)
  ON CONFLICT (owner_id, contact_id)
  DO UPDATE SET
    tier = EXCLUDED.tier,
    note = EXCLUDED.note,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_close_orbit_contact(
  p_contact_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.close_orbits
   WHERE owner_id = v_uid
     AND contact_id = p_contact_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_close_orbit()
RETURNS TABLE (
  contact_id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  status_text text,
  tier text,
  note text,
  last_seen_at timestamptz,
  direct_conversation_id uuid,
  last_interaction_at timestamptz,
  last_message_preview text,
  unread_count integer,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    co.contact_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.status_text,
    co.tier,
    co.note,
    CASE
      WHEN NOT public.is_blocked_between(v_uid, p.id)
           AND (
             p.presence_visibility = 'everyone'
             OR (
               p.presence_visibility = 'contacts'
               AND public.has_shared_direct_conversation(v_uid, p.id)
             )
           )
      THEN ups.last_seen_at
      ELSE NULL
    END AS last_seen_at,
    dc.id AS direct_conversation_id,
    dc.last_message_at AS last_interaction_at,
    dc.last_message_preview,
    coalesce(dc.unread_count, 0) AS unread_count,
    co.created_at
  FROM public.close_orbits co
  JOIN public.profiles p ON p.id = co.contact_id
  LEFT JOIN public.user_presence_state ups ON ups.user_id = p.id
  LEFT JOIN LATERAL (
    SELECT
      c.id,
      c.last_message_at,
      c.last_message_preview,
      cm_me.unread_count
    FROM public.conversations c
    JOIN public.conversation_members cm_me
      ON cm_me.conversation_id = c.id
     AND cm_me.user_id = v_uid
     AND cm_me.left_at IS NULL
    JOIN public.conversation_members cm_peer
      ON cm_peer.conversation_id = c.id
     AND cm_peer.user_id = co.contact_id
     AND cm_peer.left_at IS NULL
    WHERE c.type = 'direct'
    LIMIT 1
  ) dc ON true
  WHERE co.owner_id = v_uid
    AND NOT public.is_blocked_between(v_uid, co.contact_id)
  ORDER BY
    (co.tier = 'inner') DESC,
    coalesce(dc.last_message_at, co.created_at) DESC;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. MESSAGE PINNING & FORWARDING (Section 6)
-- ----------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forwarded_from_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_pinned
  ON public.messages (conversation_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.before_message_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Permit PostgreSQL foreign-key ON DELETE SET NULL cascades
  IF pg_trigger_depth() > 1
     AND NEW.id = OLD.id
     AND NEW.conversation_id = OLD.conversation_id
     AND NEW.kind = OLD.kind
     AND NEW.body = OLD.body
     AND (NEW.sender_id IS NOT DISTINCT FROM OLD.sender_id OR NEW.sender_id IS NULL)
     AND (NEW.reply_to_id IS NOT DISTINCT FROM OLD.reply_to_id OR NEW.reply_to_id IS NULL)
     AND (NEW.pinned_by IS NOT DISTINCT FROM OLD.pinned_by OR NEW.pinned_by IS NULL)
     AND (NEW.forwarded_from_id IS NOT DISTINCT FROM OLD.forwarded_from_id OR NEW.forwarded_from_id IS NULL) THEN
    RETURN NEW;
  END IF;

  IF NEW.id <> OLD.id
     OR NEW.conversation_id <> OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.kind <> OLD.kind
     OR NEW.created_at <> OLD.created_at
     OR NEW.forwarded_from_id IS DISTINCT FROM OLD.forwarded_from_id THEN
    RAISE EXCEPTION 'Immutable message fields cannot be altered.' USING ERRCODE = '42501';
  END IF;

  IF (NEW.pinned_at IS DISTINCT FROM OLD.pinned_at OR NEW.pinned_by IS DISTINCT FROM OLD.pinned_by)
     AND coalesce(current_setting('asterial.trusted_rpc', true), '') <> '1'
     AND NEW.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Use toggle_message_pin to pin or unpin messages.' USING ERRCODE = '42501';
  END IF;

  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Deleted messages cannot be edited or restored.' USING ERRCODE = '42501';
  END IF;

  -- Soft-deletion wipes plaintext content, unpins, and removes attachment metadata rows
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.body := '';
    NEW.has_attachments := false;
    NEW.edited_at := NULL;
    NEW.pinned_at := NULL;
    NEW.pinned_by := NULL;
    NEW.updated_at := now();

    DELETE FROM public.attachments WHERE message_id = OLD.id;

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

CREATE OR REPLACE FUNCTION public.toggle_message_pin(
  p_message_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_msg public.messages%ROWTYPE;
  v_conv_type text;
  v_role text;
  v_now timestamptz := now();
  v_next_pinned timestamptz;
  v_next_by uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_msg
    FROM public.messages
   WHERE id = p_message_id;

  IF NOT FOUND OR v_msg.deleted_at IS NOT NULL OR v_msg.kind <> 'user' THEN
    RAISE EXCEPTION 'Message cannot be pinned.' USING ERRCODE = '22023';
  END IF;

  SELECT c.type, cm.role
    INTO v_conv_type, v_role
    FROM public.conversations c
    JOIN public.conversation_members cm
      ON cm.conversation_id = c.id
     AND cm.user_id = v_uid
     AND cm.left_at IS NULL
   WHERE c.id = v_msg.conversation_id;

  IF v_conv_type IS NULL THEN
    RAISE EXCEPTION 'Conversation access denied.' USING ERRCODE = '42501';
  END IF;

  IF v_conv_type = 'group' AND v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only group owners and admins can pin or unpin messages.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_rate_limit(v_uid, 'toggle_message_pin', 30, 60);
  PERFORM set_config('asterial.trusted_rpc', '1', true);

  IF v_msg.pinned_at IS NULL THEN
    v_next_pinned := v_now;
    v_next_by := v_uid;
  ELSE
    v_next_pinned := NULL;
    v_next_by := NULL;
  END IF;

  UPDATE public.messages
     SET pinned_at = v_next_pinned,
         pinned_by = v_next_by,
         updated_at = v_now
   WHERE id = p_message_id;

  RETURN jsonb_build_object(
    'pinned', v_next_pinned IS NOT NULL,
    'pinned_at', v_next_pinned,
    'pinned_by', v_next_by
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.forward_message_to_conversations(
  p_source_message_id uuid,
  p_target_conversation_ids uuid[]
)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_src public.messages%ROWTYPE;
  v_src_author text;
  v_forward_body text;
  v_target_id uuid;
  v_new_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_target_conversation_ids IS NULL OR coalesce(array_length(p_target_conversation_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one destination conversation.' USING ERRCODE = '22023';
  END IF;

  IF array_length(p_target_conversation_ids, 1) > 10 THEN
    RAISE EXCEPTION 'Cannot forward to more than 10 conversations at once.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_src
    FROM public.messages
   WHERE id = p_source_message_id;

  IF NOT FOUND OR v_src.deleted_at IS NOT NULL OR v_src.kind <> 'user' THEN
    RAISE EXCEPTION 'Source message is unavailable.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_conversation_member(v_src.conversation_id, v_uid) THEN
    RAISE EXCEPTION 'Access denied to source message.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_rate_limit(v_uid, 'forward_message', 30, 60);

  SELECT p.display_name INTO v_src_author
    FROM public.profiles p
   WHERE p.id = v_src.sender_id;

  v_forward_body := btrim(v_src.body);
  IF char_length(v_forward_body) = 0 THEN
    v_forward_body := '[Forwarded attachment]';
  END IF;

  FOREACH v_target_id IN ARRAY ARRAY(SELECT DISTINCT unnest(p_target_conversation_ids))
  LOOP
    IF NOT public.can_send_to_conversation(v_target_id, v_uid) THEN
      RAISE EXCEPTION 'Cannot send messages to one or more selected conversations.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.messages (
      conversation_id,
      sender_id,
      kind,
      body,
      has_attachments,
      forwarded_from_id,
      metadata
    )
    VALUES (
      v_target_id,
      v_uid,
      'user',
      v_forward_body,
      false,
      v_src.id,
      jsonb_build_object(
        'forwarded', true,
        'forwarded_author', coalesce(v_src_author, 'ASTERIAL User')
      )
    )
    RETURNING id INTO v_new_id;

    RETURN NEXT v_new_id;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. VIDEO, VOICE & DOCUMENT MEDIA CONSTRAINTS + STORAGE BUCKETS (Section 15)
-- ----------------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 26214400,
       allowed_mime_types = ARRAY[
         'image/png',
         'image/jpeg',
         'image/webp',
         'image/gif',
         'video/mp4',
         'video/webm',
         'audio/webm',
         'audio/ogg',
         'audio/mp4',
         'audio/mpeg',
         'audio/wav',
         'application/pdf',
         'text/plain',
         'text/markdown',
         'text/csv',
         'application/json',
         'application/zip'
       ]
 WHERE id = 'chat-attachments';

UPDATE storage.buckets
   SET file_size_limit = 26214400,
       allowed_mime_types = ARRAY[
         'image/png',
         'image/jpeg',
         'image/webp',
         'image/gif',
         'video/mp4',
         'video/webm',
         'audio/webm',
         'audio/ogg',
         'audio/mp4',
         'audio/mpeg',
         'audio/wav',
         'application/pdf',
         'text/plain',
         'text/markdown',
         'text/csv',
         'application/json',
         'application/zip'
       ]
 WHERE id = 'social-media';

ALTER TABLE public.attachments
  DROP CONSTRAINT IF EXISTS attachments_byte_size_chk,
  DROP CONSTRAINT IF EXISTS attachments_mime_chk;

ALTER TABLE public.attachments
  ADD CONSTRAINT attachments_byte_size_chk
    CHECK (byte_size > 0 AND byte_size <= 26214400),
  ADD CONSTRAINT attachments_mime_chk
    CHECK (mime_type = ANY (ARRAY[
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'audio/webm',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav',
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/zip'
    ]));

ALTER TABLE public.orbit_messages
  DROP CONSTRAINT IF EXISTS orbit_messages_att_size_chk,
  DROP CONSTRAINT IF EXISTS orbit_messages_att_mime_chk;

ALTER TABLE public.orbit_messages
  ADD CONSTRAINT orbit_messages_att_size_chk
    CHECK (attachment_size IS NULL OR (attachment_size > 0 AND attachment_size <= 26214400)),
  ADD CONSTRAINT orbit_messages_att_mime_chk
    CHECK (attachment_mime IS NULL OR attachment_mime = ANY (ARRAY[
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'audio/webm',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav',
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/zip'
    ]));

ALTER TABLE public.moments
  DROP CONSTRAINT IF EXISTS moments_audience_chk,
  DROP CONSTRAINT IF EXISTS moments_media_mime_chk;

ALTER TABLE public.moments
  ADD CONSTRAINT moments_audience_chk
    CHECK (audience = ANY (ARRAY['everyone', 'contacts', 'orbit'])),
  ADD CONSTRAINT moments_media_mime_chk
    CHECK (media_mime IS NULL OR media_mime = ANY (ARRAY[
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm'
    ]));

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_visibility_chk,
  DROP CONSTRAINT IF EXISTS posts_media_size_chk,
  DROP CONSTRAINT IF EXISTS posts_media_mime_chk;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_visibility_chk
    CHECK (visibility = ANY (ARRAY['public', 'contacts', 'orbit'])),
  ADD CONSTRAINT posts_media_size_chk
    CHECK (media_size IS NULL OR (media_size > 0 AND media_size <= 26214400)),
  ADD CONSTRAINT posts_media_mime_chk
    CHECK (media_mime IS NULL OR media_mime = ANY (ARRAY[
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm'
    ]));

-- Update Moment & Post visibility helpers to support 'orbit' (Close Connections)
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
             OR (
               m.audience = 'orbit'
               AND public.is_in_author_close_orbit(m.author_id, p_user_id)
             )
           )
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
             OR (
               p.visibility = 'orbit'
               AND public.is_in_author_close_orbit(p.author_id, p_user_id)
             )
           )
         )
       )
  );
$$;

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
      p_scope = 'all'
      OR (
        p_scope = 'contacts'
        AND (p.author_id = v_uid OR public.has_shared_direct_conversation(v_uid, p.author_id))
      )
      OR (
        p_scope = 'orbit'
        AND (p.author_id = v_uid OR EXISTS (
          SELECT 1 FROM public.close_orbits co
           WHERE co.owner_id = v_uid AND co.contact_id = p.author_id
        ))
      )
    )
    AND (
      p_before_created_at IS NULL
      OR p.created_at < p_before_created_at
      OR (p.created_at = p_before_created_at AND (p_before_id IS NULL OR p.id < p_before_id))
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT v_lim;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. THREADED REPLIES ON FEED COMMENTS (Section 12)
-- ----------------------------------------------------------------------------
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent
  ON public.post_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. UNIFIED AUTHORIZED SEARCH RPCS FOR MOMENTS & FEED POSTS (Section 13)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_moments(
  p_query text,
  p_limit integer DEFAULT 20
)
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
  audience text,
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
  v_q text := btrim(coalesce(p_query, ''));
  v_lim integer := LEAST(GREATEST(coalesce(p_limit, 20), 1), 40);
BEGIN
  IF v_uid IS NULL OR char_length(v_q) < 2 THEN
    RETURN;
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
    m.audience,
    m.created_at,
    m.expires_at
  FROM public.moments m
  JOIN public.profiles pr ON pr.id = m.author_id
  WHERE m.deleted_at IS NULL
    AND m.expires_at > now()
    AND public.can_view_moment(m.id, v_uid)
    AND (
      m.caption ILIKE '%' || v_q || '%'
      OR pr.username ILIKE '%' || v_q || '%'
      OR pr.display_name ILIKE '%' || v_q || '%'
    )
  ORDER BY m.created_at DESC
  LIMIT v_lim;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_feed_posts(
  p_query text,
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
  like_count integer,
  comment_count integer,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q text := btrim(coalesce(p_query, ''));
  v_lim integer := LEAST(GREATEST(coalesce(p_limit, 20), 1), 40);
BEGIN
  IF v_uid IS NULL OR char_length(v_q) < 2 THEN
    RETURN;
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
    p.like_count,
    p.comment_count,
    p.created_at
  FROM public.posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.deleted_at IS NULL
    AND public.can_view_post(p.id, v_uid)
    AND (
      p.body ILIKE '%' || v_q || '%'
      OR pr.username ILIKE '%' || v_q || '%'
      OR pr.display_name ILIKE '%' || v_q || '%'
    )
  ORDER BY p.created_at DESC
  LIMIT v_lim;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. APPEARANCE THEME ('system'), ACCENT COLOR & CHAT WALLPAPER PREFERENCES
-- ----------------------------------------------------------------------------
ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notif_prefs_theme_chk;

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT 'indigo',
  ADD COLUMN IF NOT EXISTS chat_wallpaper text NOT NULL DEFAULT 'constellation';

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notif_prefs_accent_chk,
  DROP CONSTRAINT IF EXISTS notif_prefs_wallpaper_chk;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notif_prefs_theme_chk
    CHECK (appearance_theme = ANY (ARRAY['obsidian', 'pitch', 'graphite', 'alabaster', 'system'])),
  ADD CONSTRAINT notif_prefs_accent_chk
    CHECK (accent_color = ANY (ARRAY['indigo', 'cobalt', 'emerald', 'amber', 'monochrome'])),
  ADD CONSTRAINT notif_prefs_wallpaper_chk
    CHECK (chat_wallpaper = ANY (ARRAY['none', 'constellation', 'grid', 'aurora']));

-- Grant execute permissions on new/updated RPCs to authenticated role
GRANT EXECUTE ON FUNCTION public.is_in_author_close_orbit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_close_orbit_contact(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_close_orbit_contact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_close_orbit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_message_pin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forward_message_to_conversations(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_moments(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_feed_posts(text, integer) TO authenticated;
