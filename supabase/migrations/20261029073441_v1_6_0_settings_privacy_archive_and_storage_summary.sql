-- ============================================================================
-- ASTERIAL v1.6.0 — Complete Product Redesign: Chat Preferences, Privacy
-- Controls (Group Invites, Search Discoverability, Default Moment Audience),
-- Archive-on-Message Behavior, and Authorized Storage Usage Summary
-- ============================================================================

-- 1. Add real Chat & Media Preferences to public.notification_preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS enter_to_send boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_link_previews boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS media_auto_download text NOT NULL DEFAULT 'always',
  ADD COLUMN IF NOT EXISTS keep_chats_archived boolean NOT NULL DEFAULT true;

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_media_auto_download_check;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_media_auto_download_check
  CHECK (media_auto_download IN ('always', 'images_only', 'manual'));

-- 2. Add real Server-Enforced Privacy Controls to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS moments_default_audience text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS group_invite_permission text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS discoverable_by_search boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_moments_default_audience_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_moments_default_audience_check
  CHECK (moments_default_audience IN ('everyone', 'contacts', 'orbit'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_group_invite_permission_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_group_invite_permission_check
  CHECK (group_invite_permission IN ('everyone', 'contacts', 'nobody'));

-- 3. Server-side helper: can_add_user_to_group(actor, target)
CREATE OR REPLACE FUNCTION public.can_add_user_to_group(
  p_actor_id uuid,
  p_target_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_perm text;
BEGIN
  IF p_actor_id IS NULL OR p_target_id IS NULL OR p_actor_id = p_target_id THEN
    RETURN false;
  END IF;

  IF public.is_blocked_between(p_actor_id, p_target_id) THEN
    RETURN false;
  END IF;

  SELECT group_invite_permission INTO v_perm
  FROM public.profiles
  WHERE id = p_target_id;

  IF v_perm IS NULL THEN
    RETURN false;
  END IF;

  IF v_perm = 'everyone' THEN
    RETURN true;
  ELSIF v_perm = 'contacts' THEN
    RETURN public.has_shared_direct_conversation(p_actor_id, p_target_id);
  ELSE
    RETURN false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.can_add_user_to_group(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_add_user_to_group(uuid, uuid) TO authenticated;

-- 4. Enforce group_invite_permission in create_group_conversation & add_group_members
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  p_name text,
  p_description text DEFAULT ''::text,
  p_member_ids uuid[] DEFAULT '{}'::uuid[],
  p_avatar_url text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean_name text := btrim(coalesce(p_name, ''));
  v_conv_id uuid;
  v_actor_name text;
  v_member_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_rate_limit(v_uid, 'create_group', 10, 60);

  IF char_length(v_clean_name) < 1 OR char_length(v_clean_name) > 80 THEN
    RAISE EXCEPTION 'Group name must be between 1 and 80 characters.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('asterial.trusted_rpc', '1', true);

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.conversations (type, name, description, avatar_url, created_by)
  VALUES ('group', v_clean_name, left(coalesce(p_description, ''), 300), p_avatar_url, v_uid)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.conversation_members (conversation_id, user_id, role)
  VALUES (v_conv_id, v_uid, 'owner');

  IF p_member_ids IS NOT NULL THEN
    FOREACH v_member_id IN ARRAY p_member_ids LOOP
      IF v_member_id IS NOT NULL
         AND v_member_id <> v_uid
         AND public.can_add_user_to_group(v_uid, v_member_id) THEN
        INSERT INTO public.conversation_members (conversation_id, user_id, role)
        VALUES (v_conv_id, v_member_id, 'member')
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, kind, body, metadata)
  VALUES (
    v_conv_id,
    v_uid,
    'system',
    coalesce(v_actor_name, 'Someone') || ' created "' || v_clean_name || '"',
    jsonb_build_object('event', 'group_created', 'actor_id', v_uid)
  );

  RETURN v_conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_group_members(
  p_conversation_id uuid,
  p_member_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_conv_type text;
  v_actor_name text;
  v_target_name text;
  v_member_id uuid;
  v_added integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT type INTO v_conv_type FROM public.conversations WHERE id = p_conversation_id;
  IF v_conv_type IS DISTINCT FROM 'group' THEN
    RAISE EXCEPTION 'Group conversation not found.' USING ERRCODE = 'P0002';
  END IF;

  v_role := public.get_conversation_role(p_conversation_id, v_uid);
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only group owners and administrators can add members.' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('asterial.trusted_rpc', '1', true);
  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = v_uid;

  IF p_member_ids IS NOT NULL THEN
    FOREACH v_member_id IN ARRAY p_member_ids LOOP
      IF v_member_id IS NOT NULL
         AND v_member_id <> v_uid
         AND NOT public.is_conversation_member(p_conversation_id, v_member_id)
         AND public.can_add_user_to_group(v_uid, v_member_id) THEN
        SELECT display_name INTO v_target_name FROM public.profiles WHERE id = v_member_id;
        IF v_target_name IS NOT NULL THEN
          INSERT INTO public.conversation_members (
            conversation_id, user_id, role, joined_at, left_at, unread_count, archived, archived_at
          )
          VALUES (
            p_conversation_id, v_member_id, 'member', now(), NULL, 0, false, NULL
          )
          ON CONFLICT (conversation_id, user_id) DO UPDATE
            SET role = 'member',
                joined_at = now(),
                left_at = NULL,
                unread_count = 0,
                archived = false,
                archived_at = NULL;

          v_added := v_added + 1;

          INSERT INTO public.messages (conversation_id, sender_id, kind, body, metadata)
          VALUES (
            p_conversation_id,
            v_uid,
            'system',
            coalesce(v_actor_name, 'Admin') || ' added ' || v_target_name,
            jsonb_build_object('event', 'member_added', 'actor_id', v_uid, 'target_id', v_member_id)
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN v_added;
END;
$$;

-- 5. Enforce discoverable_by_search in search_users (preserving exact return table)
CREATE OR REPLACE FUNCTION public.search_users(
  p_query text DEFAULT ''::text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  status_text text,
  allow_direct_messages text,
  last_seen_at timestamptz,
  is_blocked_by_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_lim integer := LEAST(GREATEST(coalesce(p_limit, 20), 1), 50);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_rate_limit(v_uid, 'search_users', 45, 60);

  IF left(v_q, 1) = '@' THEN
    v_q := substr(v_q, 2);
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.status_text,
    p.allow_direct_messages,
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
    EXISTS (
      SELECT 1 FROM public.user_blocks ub
       WHERE ub.blocker_id = v_uid AND ub.blocked_id = p.id
    ) AS is_blocked_by_me
  FROM public.profiles p
  LEFT JOIN public.user_presence_state ups ON ups.user_id = p.id
  WHERE p.id <> v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub_rev
       WHERE ub_rev.blocker_id = p.id AND ub_rev.blocked_id = v_uid
    )
    AND (
      p.discoverable_by_search = true
      OR public.has_shared_direct_conversation(v_uid, p.id)
      OR (v_q <> '' AND p.username = v_q)
    )
    AND (
      v_q = ''
      OR p.username ILIKE '%' || v_q || '%'
      OR lower(p.display_name) ILIKE '%' || v_q || '%'
    )
  ORDER BY
    CASE
      WHEN v_q <> '' AND p.username = v_q THEN 0
      WHEN v_q <> '' AND p.username ILIKE v_q || '%' THEN 1
      WHEN v_q <> '' AND lower(p.display_name) ILIKE v_q || '%' THEN 2
      ELSE 3
    END,
    p.display_name ASC
  LIMIT v_lim;
END;
$$;

-- 6. Honor keep_chats_archived in after_message_insert_sync()
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
    UPDATE public.conversation_members cm
       SET unread_count = cm.unread_count + 1,
           archived = CASE
             WHEN cm.archived = true
                  AND coalesce(
                    (SELECT np.keep_chats_archived
                       FROM public.notification_preferences np
                      WHERE np.user_id = cm.user_id),
                    true
                  ) = false
             THEN false
             ELSE cm.archived
           END,
           archived_at = CASE
             WHEN cm.archived = true
                  AND coalesce(
                    (SELECT np.keep_chats_archived
                       FROM public.notification_preferences np
                      WHERE np.user_id = cm.user_id),
                    true
                  ) = false
             THEN NULL
             ELSE cm.archived_at
           END
     WHERE cm.conversation_id = NEW.conversation_id
       AND (NEW.sender_id IS NULL OR cm.user_id <> NEW.sender_id)
       AND cm.left_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Authorized Storage & Media Summary RPC for /app/settings/storage
CREATE OR REPLACE FUNCTION public.get_my_storage_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_chat_count integer := 0;
  v_chat_bytes bigint := 0;
  v_post_count integer := 0;
  v_post_bytes bigint := 0;
  v_orbit_count integer := 0;
  v_orbit_bytes bigint := 0;
  v_moment_count integer := 0;
  v_recent jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer, coalesce(sum(byte_size), 0)::bigint
    INTO v_chat_count, v_chat_bytes
    FROM public.attachments
   WHERE uploader_id = v_uid;

  SELECT count(*)::integer, coalesce(sum(media_size), 0)::bigint
    INTO v_post_count, v_post_bytes
    FROM public.posts
   WHERE author_id = v_uid
     AND deleted_at IS NULL
     AND media_path IS NOT NULL;

  SELECT count(*)::integer, coalesce(sum(attachment_size), 0)::bigint
    INTO v_orbit_count, v_orbit_bytes
    FROM public.orbit_messages
   WHERE sender_id = v_uid
     AND deleted_at IS NULL
     AND attachment_path IS NOT NULL;

  SELECT count(*)::integer
    INTO v_moment_count
    FROM public.moments
   WHERE author_id = v_uid
     AND expires_at > now()
     AND media_path IS NOT NULL;

  SELECT coalesce(jsonb_agg(item_row), '[]'::jsonb)
    INTO v_recent
    FROM (
      SELECT
        a.id,
        'chat'::text AS source,
        a.conversation_id,
        a.file_name,
        a.mime_type,
        a.byte_size,
        a.storage_path,
        'chat-attachments'::text AS bucket,
        a.created_at
      FROM public.attachments a
      WHERE a.uploader_id = v_uid
      UNION ALL
      SELECT
        p.id,
        'feed'::text AS source,
        NULL::uuid AS conversation_id,
        coalesce(p.media_name, 'Post media') AS file_name,
        coalesce(p.media_mime, 'application/octet-stream') AS mime_type,
        coalesce(p.media_size, 0) AS byte_size,
        p.media_path AS storage_path,
        'social-media'::text AS bucket,
        p.created_at
      FROM public.posts p
      WHERE p.author_id = v_uid
        AND p.deleted_at IS NULL
        AND p.media_path IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 20
    ) item_row;

  RETURN jsonb_build_object(
    'chat_attachment_count', v_chat_count,
    'chat_attachment_bytes', v_chat_bytes,
    'feed_media_count', v_post_count,
    'feed_media_bytes', v_post_bytes,
    'orbit_media_count', v_orbit_count,
    'orbit_media_bytes', v_orbit_bytes,
    'active_moment_media_count', v_moment_count,
    'total_tracked_bytes', (v_chat_bytes + v_post_bytes + v_orbit_bytes),
    'recent_uploads', v_recent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_storage_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_storage_summary() TO authenticated;
