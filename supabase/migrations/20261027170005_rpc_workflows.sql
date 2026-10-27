-- ASTERIAL v1.1 — Migration 03: Atomic Server-Side RPC Workflows
-- Official Developer: Ritam Das | By X Huracan

-- 1. Check username availability (excludes caller's own current username)
CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean text;
BEGIN
  v_clean := lower(btrim(coalesce(p_username, '')));
  IF v_clean !~ '^[a-z0-9_]{3,24}$' THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE lower(p.username) = v_clean
       AND (auth.uid() IS NULL OR p.id <> auth.uid())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;

-- 2. Complete or update profile onboarding atomically
CREATE OR REPLACE FUNCTION public.complete_profile_onboarding(
  p_username text,
  p_display_name text,
  p_bio text DEFAULT '',
  p_status_text text DEFAULT ''
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_display text := btrim(coalesce(p_display_name, ''));
  v_profile public.profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  PERFORM public.check_rate_limit(v_uid, 'profile_update', 20, 60);

  IF v_username !~ '^[a-z0-9_]{3,24}$' THEN
    RAISE EXCEPTION 'Username must be 3–24 characters using lowercase letters, numbers, or underscores.'
      USING ERRCODE = '22023';
  END IF;

  IF char_length(v_display) < 1 OR char_length(v_display) > 60 THEN
    RAISE EXCEPTION 'Display name must be between 1 and 60 characters.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles p WHERE lower(p.username) = v_username AND p.id <> v_uid
  ) THEN
    RAISE EXCEPTION 'That username is already taken.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.profiles (id, username, display_name, bio, status_text, onboarding_completed)
  VALUES (
    v_uid,
    v_username,
    v_display,
    left(coalesce(p_bio, ''), 280),
    left(coalesce(p_status_text, ''), 80),
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        bio = EXCLUDED.bio,
        status_text = EXCLUDED.status_text,
        onboarding_completed = true,
        updated_at = now()
  RETURNING * INTO v_profile;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_presence_state (user_id, last_seen_at)
  VALUES (v_uid, now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_profile_onboarding(text, text, text, text) TO authenticated;

-- 3. User Discovery & Search (rate-limited, block-aware, never exposes email, enforces presence privacy)
CREATE OR REPLACE FUNCTION public.search_users(
  p_query text DEFAULT '',
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
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

  -- Strip leading '@' if user searched @handle
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
    -- Hide users who have blocked the caller
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks ub_rev
       WHERE ub_rev.blocker_id = p.id AND ub_rev.blocked_id = v_uid
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

GRANT EXECUTE ON FUNCTION public.search_users(text, integer) TO authenticated;

-- 4. Create or get direct conversation idempotently (zero duplicates, block & privacy enforced)
CREATE OR REPLACE FUNCTION public.create_or_get_direct_conversation(p_target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pair_key text;
  v_conv_id uuid;
  v_target_allow_dm text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL OR p_target_user_id = v_uid THEN
    RAISE EXCEPTION 'Select another user to start a conversation.' USING ERRCODE = '22023';
  END IF;

  PERFORM public.check_rate_limit(v_uid, 'create_direct_conversation', 25, 60);

  SELECT allow_direct_messages INTO v_target_allow_dm
    FROM public.profiles
   WHERE id = p_target_user_id;

  IF v_target_allow_dm IS NULL THEN
    RAISE EXCEPTION 'User not found.' USING ERRCODE = 'P0002';
  END IF;

  IF public.is_blocked_between(v_uid, p_target_user_id) THEN
    RAISE EXCEPTION 'Cannot start or open a direct conversation due to block settings.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('asterial.trusted_rpc', '1', true);

  v_pair_key := LEAST(v_uid::text, p_target_user_id::text) || ':' || GREATEST(v_uid::text, p_target_user_id::text);

  SELECT id INTO v_conv_id
    FROM public.conversations
   WHERE direct_pair_key = v_pair_key;

  IF v_conv_id IS NULL THEN
    IF v_target_allow_dm = 'none' THEN
      RAISE EXCEPTION 'This user is not accepting new direct conversations.'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.conversations (type, direct_pair_key, created_by)
    VALUES ('direct', v_pair_key, v_uid)
    ON CONFLICT (direct_pair_key) DO UPDATE
      SET updated_at = public.conversations.updated_at
    RETURNING id INTO v_conv_id;
  END IF;

  INSERT INTO public.conversation_members (conversation_id, user_id, role, archived, archived_at, left_at)
  VALUES (v_conv_id, v_uid, 'member', false, NULL, NULL)
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET archived = false,
        archived_at = NULL,
        left_at = NULL;

  INSERT INTO public.conversation_members (conversation_id, user_id, role, left_at)
  VALUES (v_conv_id, p_target_user_id, 'member', NULL)
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET left_at = NULL;

  RETURN v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_get_direct_conversation(uuid) TO authenticated;

-- 5. Create group conversation with owner role, validated members, and initial system event
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  p_name text,
  p_description text DEFAULT '',
  p_member_ids uuid[] DEFAULT '{}',
  p_avatar_url text DEFAULT NULL
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
         AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_member_id)
         AND NOT public.is_blocked_between(v_uid, v_member_id) THEN
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

GRANT EXECUTE ON FUNCTION public.create_group_conversation(text, text, uuid[], text) TO authenticated;

-- 6. Add members to an existing group (owner/admin only)
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
         AND NOT public.is_blocked_between(v_uid, v_member_id) THEN
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

GRANT EXECUTE ON FUNCTION public.add_group_members(uuid, uuid[]) TO authenticated;

-- 7. Remove a group member (enforces owner > admin > member hierarchy)
CREATE OR REPLACE FUNCTION public.remove_group_member(
  p_conversation_id uuid,
  p_target_user_id uuid
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
  v_actor_name text;
  v_target_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id = v_uid THEN
    RAISE EXCEPTION 'Use leave_group_conversation to leave a group.' USING ERRCODE = '22023';
  END IF;

  v_actor_role := public.get_conversation_role(p_conversation_id, v_uid);
  v_target_role := public.get_conversation_role(p_conversation_id, p_target_user_id);

  IF v_actor_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to remove group members.' USING ERRCODE = '42501';
  END IF;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not an active member of this group.' USING ERRCODE = 'P0002';
  END IF;

  IF v_target_role = 'owner' OR (v_actor_role = 'admin' AND v_target_role = 'admin') THEN
    RAISE EXCEPTION 'Cannot remove a member with equal or higher role.' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('asterial.trusted_rpc', '1', true);

  UPDATE public.conversation_members
     SET left_at = now(),
         pinned = false,
         pinned_at = NULL,
         unread_count = 0
   WHERE conversation_id = p_conversation_id
     AND user_id = p_target_user_id
     AND left_at IS NULL;

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = v_uid;
  SELECT display_name INTO v_target_name FROM public.profiles WHERE id = p_target_user_id;

  INSERT INTO public.messages (conversation_id, sender_id, kind, body, metadata)
  VALUES (
    p_conversation_id,
    v_uid,
    'system',
    coalesce(v_actor_name, 'Admin') || ' removed ' || coalesce(v_target_name, 'a member'),
    jsonb_build_object('event', 'member_removed', 'actor_id', v_uid, 'target_id', p_target_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_group_member(uuid, uuid) TO authenticated;

-- 8. Update group member role (owner only)
CREATE OR REPLACE FUNCTION public.update_group_member_role(
  p_conversation_id uuid,
  p_target_user_id uuid,
  p_new_role text
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
  v_actor_name text;
  v_target_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_new_role NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role.' USING ERRCODE = '22023';
  END IF;

  v_actor_role := public.get_conversation_role(p_conversation_id, v_uid);
  IF v_actor_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Only the group owner can change member roles.' USING ERRCODE = '42501';
  END IF;

  v_target_role := public.get_conversation_role(p_conversation_id, p_target_user_id);
  IF v_target_role IS NULL OR p_target_user_id = v_uid THEN
    RAISE EXCEPTION 'Invalid target member.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('asterial.trusted_rpc', '1', true);

  IF p_new_role = 'owner' THEN
    UPDATE public.conversation_members
       SET role = 'admin'
     WHERE conversation_id = p_conversation_id AND user_id = v_uid;
  END IF;

  UPDATE public.conversation_members
     SET role = p_new_role
   WHERE conversation_id = p_conversation_id
     AND user_id = p_target_user_id
     AND left_at IS NULL;

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = v_uid;
  SELECT display_name INTO v_target_name FROM public.profiles WHERE id = p_target_user_id;

  INSERT INTO public.messages (conversation_id, sender_id, kind, body, metadata)
  VALUES (
    p_conversation_id,
    v_uid,
    'system',
    coalesce(v_actor_name, 'Owner') || ' updated ' || coalesce(v_target_name, 'member') || '''s role to ' || p_new_role,
    jsonb_build_object('event', 'role_updated', 'actor_id', v_uid, 'target_id', p_target_user_id, 'role', p_new_role)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_group_member_role(uuid, uuid, text) TO authenticated;

-- 9. Update group details (owner/admin only)
CREATE OR REPLACE FUNCTION public.update_group_details(
  p_conversation_id uuid,
  p_name text,
  p_description text DEFAULT '',
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_old_name text;
  v_clean_name text := btrim(coalesce(p_name, ''));
  v_actor_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_role := public.get_conversation_role(p_conversation_id, v_uid);
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only group owners and administrators can edit group settings.' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_clean_name) < 1 OR char_length(v_clean_name) > 80 THEN
    RAISE EXCEPTION 'Group name must be between 1 and 80 characters.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('asterial.trusted_rpc', '1', true);

  SELECT name INTO v_old_name FROM public.conversations WHERE id = p_conversation_id AND type = 'group';
  IF v_old_name IS NULL THEN
    RAISE EXCEPTION 'Group not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.conversations
     SET name = v_clean_name,
         description = left(coalesce(p_description, ''), 300),
         avatar_url = coalesce(p_avatar_url, avatar_url),
         updated_at = now()
   WHERE id = p_conversation_id;

  IF v_old_name IS DISTINCT FROM v_clean_name THEN
    SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = v_uid;
    INSERT INTO public.messages (conversation_id, sender_id, kind, body, metadata)
    VALUES (
      p_conversation_id,
      v_uid,
      'system',
      coalesce(v_actor_name, 'Admin') || ' renamed the group to "' || v_clean_name || '"',
      jsonb_build_object('event', 'group_renamed', 'actor_id', v_uid, 'name', v_clean_name)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_group_details(uuid, text, text, text) TO authenticated;

-- 10. Leave group conversation (auto-promotes next admin/member if owner leaves)
CREATE OR REPLACE FUNCTION public.leave_group_conversation(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_conv_type text;
  v_successor_id uuid;
  v_actor_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  SELECT type INTO v_conv_type FROM public.conversations WHERE id = p_conversation_id;
  IF v_conv_type IS DISTINCT FROM 'group' THEN
    RAISE EXCEPTION 'Only group conversations support leaving.' USING ERRCODE = '22023';
  END IF;

  v_role := public.get_conversation_role(p_conversation_id, v_uid);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'You are not an active member of this group.' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('asterial.trusted_rpc', '1', true);

  UPDATE public.conversation_members
     SET left_at = now(),
         pinned = false,
         pinned_at = NULL,
         unread_count = 0
   WHERE conversation_id = p_conversation_id
     AND user_id = v_uid;

  SELECT display_name INTO v_actor_name FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.messages (conversation_id, sender_id, kind, body, metadata)
  VALUES (
    p_conversation_id,
    v_uid,
    'system',
    coalesce(v_actor_name, 'A member') || ' left the group',
    jsonb_build_object('event', 'member_left', 'actor_id', v_uid)
  );

  IF v_role = 'owner' THEN
    SELECT cm.user_id INTO v_successor_id
      FROM public.conversation_members cm
     WHERE cm.conversation_id = p_conversation_id
       AND cm.left_at IS NULL
     ORDER BY (cm.role = 'admin') DESC, cm.joined_at ASC
     LIMIT 1;

    IF v_successor_id IS NOT NULL THEN
      UPDATE public.conversation_members
         SET role = 'owner'
       WHERE conversation_id = p_conversation_id
         AND user_id = v_successor_id;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_group_conversation(uuid) TO authenticated;

-- 11. Acknowledge message delivery (records real delivered_at timestamps when client receives messages)
CREATE OR REPLACE FUNCTION public.acknowledge_delivery(p_conversation_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inserted integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  WITH eligible AS (
    SELECT m.id AS message_id, m.conversation_id
      FROM public.messages m
      JOIN public.conversation_members cm
        ON cm.conversation_id = m.conversation_id
       AND cm.user_id = v_uid
       AND cm.left_at IS NULL
     WHERE m.kind = 'user'
       AND m.deleted_at IS NULL
       AND m.sender_id IS NOT NULL
       AND m.sender_id <> v_uid
       AND (p_conversation_id IS NULL OR m.conversation_id = p_conversation_id)
       AND NOT EXISTS (
         SELECT 1
           FROM public.message_receipts mr
          WHERE mr.message_id = m.id
            AND mr.user_id = v_uid
       )
     ORDER BY m.created_at DESC
     LIMIT 200
  ),
  ins AS (
    INSERT INTO public.message_receipts (message_id, user_id, conversation_id, delivered_at)
    SELECT message_id, v_uid, conversation_id, now()
      FROM eligible
    ON CONFLICT (message_id, user_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_inserted FROM ins;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acknowledge_delivery(uuid) TO authenticated;

-- 12. Mark conversation read (clears unread count & records real read_at respecting read_receipts_enabled)
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_latest_msg_id uuid;
  v_share_read boolean := true;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_conversation_member(p_conversation_id, v_uid) THEN
    RAISE EXCEPTION 'Conversation access denied.' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('asterial.trusted_rpc', '1', true);

  SELECT id INTO v_latest_msg_id
    FROM public.messages
   WHERE conversation_id = p_conversation_id
   ORDER BY created_at DESC, id DESC
   LIMIT 1;

  UPDATE public.conversation_members
     SET unread_count = 0,
         last_read_at = now(),
         last_read_message_id = coalesce(v_latest_msg_id, last_read_message_id)
   WHERE conversation_id = p_conversation_id
     AND user_id = v_uid
     AND left_at IS NULL;

  SELECT coalesce(read_receipts_enabled, true) INTO v_share_read
    FROM public.profiles
   WHERE id = v_uid;

  INSERT INTO public.message_receipts (message_id, user_id, conversation_id, delivered_at, read_at)
  SELECT
    m.id,
    v_uid,
    m.conversation_id,
    now(),
    CASE WHEN v_share_read THEN now() ELSE NULL END
  FROM public.messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.kind = 'user'
    AND m.deleted_at IS NULL
    AND m.sender_id IS NOT NULL
    AND m.sender_id <> v_uid
  ON CONFLICT (message_id, user_id) DO UPDATE
    SET read_at = CASE
      WHEN v_share_read THEN coalesce(public.message_receipts.read_at, now())
      ELSE public.message_receipts.read_at
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- 13. Search accessible messages across conversations where caller is an active member
CREATE OR REPLACE FUNCTION public.search_messages(
  p_query text,
  p_conversation_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30
)
RETURNS TABLE (
  message_id uuid,
  conversation_id uuid,
  conversation_type text,
  conversation_name text,
  sender_id uuid,
  sender_display_name text,
  sender_username text,
  body text,
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
  v_lim integer := LEAST(GREATEST(coalesce(p_limit, 30), 1), 60);
BEGIN
  IF v_uid IS NULL OR char_length(v_q) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id AS message_id,
    m.conversation_id,
    c.type AS conversation_type,
    CASE
      WHEN c.type = 'group' THEN c.name
      ELSE (
        SELECT peer_p.display_name
          FROM public.conversation_members peer_cm
          JOIN public.profiles peer_p ON peer_p.id = peer_cm.user_id
         WHERE peer_cm.conversation_id = c.id
           AND peer_cm.user_id <> v_uid
         LIMIT 1
      )
    END AS conversation_name,
    m.sender_id,
    sp.display_name AS sender_display_name,
    sp.username AS sender_username,
    m.body,
    m.created_at
  FROM public.messages m
  JOIN public.conversation_members cm
    ON cm.conversation_id = m.conversation_id
   AND cm.user_id = v_uid
   AND cm.left_at IS NULL
  JOIN public.conversations c
    ON c.id = m.conversation_id
  LEFT JOIN public.profiles sp
    ON sp.id = m.sender_id
  WHERE m.kind = 'user'
    AND m.deleted_at IS NULL
    AND (p_conversation_id IS NULL OR m.conversation_id = p_conversation_id)
    AND m.body ILIKE '%' || v_q || '%'
  ORDER BY m.created_at DESC
  LIMIT v_lim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_messages(text, uuid, integer) TO authenticated;

-- 14. Throttled presence heartbeat (respects presence_visibility = 'nobody' and avoids write churn)
CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_vis text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT presence_visibility INTO v_vis FROM public.profiles WHERE id = v_uid;
  IF v_vis = 'nobody' THEN
    DELETE FROM public.user_presence_state WHERE user_id = v_uid;
    RETURN;
  END IF;

  INSERT INTO public.user_presence_state (user_id, last_seen_at, updated_at)
  VALUES (v_uid, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = now(),
        updated_at = now()
  WHERE public.user_presence_state.updated_at < now() - interval '60 seconds';
END;
$$;

GRANT EXECUTE ON FUNCTION public.touch_presence() TO authenticated;

-- 15. Secure self-service account deletion & storage cleanup
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

  -- Clean up storage objects uploaded by this user
  DELETE FROM storage.objects
   WHERE (bucket_id = 'avatars' AND (storage.foldername(name))[1] = v_uid::text)
      OR (bucket_id = 'chat-attachments' AND (storage.foldername(name))[2] = v_uid::text);

  -- Transfer ownership of any groups owned by this user before deletion
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

  -- Soft-wipe message bodies sent by this user before auth cascade sets sender_id = NULL
  UPDATE public.messages
     SET body = '',
         has_attachments = false,
         deleted_at = coalesce(deleted_at, now()),
         updated_at = now()
   WHERE sender_id = v_uid
     AND kind = 'user'
     AND deleted_at IS NULL;

  -- Delete auth.users record (cascades to profiles, memberships, preferences, blocks, etc.)
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
