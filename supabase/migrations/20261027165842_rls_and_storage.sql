-- ASTERIAL v1.1 — Migration 02: Mandatory Row Level Security, Storage Buckets & Realtime
-- Official Developer: Ritam Das | By X Huracan

-- Constrained SECURITY DEFINER authorization helpers (prevents recursive RLS evaluation)
CREATE OR REPLACE FUNCTION public.is_conversation_member(
  p_conversation_id uuid,
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
      FROM public.conversation_members cm
     WHERE cm.conversation_id = p_conversation_id
       AND cm.user_id = p_user_id
       AND cm.left_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.get_conversation_role(
  p_conversation_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT cm.role
    FROM public.conversation_members cm
   WHERE cm.conversation_id = p_conversation_id
     AND cm.user_id = p_user_id
     AND cm.left_at IS NULL
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_between(
  p_user_a uuid,
  p_user_b uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_blocks ub
     WHERE (ub.blocker_id = p_user_a AND ub.blocked_id = p_user_b)
        OR (ub.blocker_id = p_user_b AND ub.blocked_id = p_user_a)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_shared_direct_conversation(
  p_user_a uuid,
  p_user_b uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.conversations c
      WHERE c.type = 'direct'
       AND c.direct_pair_key = (
         LEAST(p_user_a::text, p_user_b::text) || ':' || GREATEST(p_user_a::text, p_user_b::text)
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_send_to_conversation(
  p_conversation_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type text;
  v_peer_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.is_conversation_member(p_conversation_id, p_user_id) THEN
    RETURN false;
  END IF;

  SELECT c.type INTO v_type
    FROM public.conversations c
   WHERE c.id = p_conversation_id;

  IF v_type IS NULL THEN
    RETURN false;
  END IF;

  IF v_type = 'direct' THEN
    SELECT cm.user_id INTO v_peer_id
      FROM public.conversation_members cm
     WHERE cm.conversation_id = p_conversation_id
       AND cm.user_id <> p_user_id
     LIMIT 1;

    IF v_peer_id IS NOT NULL AND public.is_blocked_between(p_user_id, v_peer_id) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_shared_direct_conversation(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_to_conversation(uuid, uuid) TO authenticated;

-- Enable Row Level Security across EVERY exposed table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. User Presence State Policies (strictly enforces presence_visibility & block rules)
DROP POLICY IF EXISTS presence_select_authorized ON public.user_presence_state;
CREATE POLICY presence_select_authorized
  ON public.user_presence_state
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      NOT public.is_blocked_between(auth.uid(), user_id)
      AND EXISTS (
        SELECT 1
          FROM public.profiles p
         WHERE p.id = user_presence_state.user_id
           AND (
             p.presence_visibility = 'everyone'
             OR (
               p.presence_visibility = 'contacts'
               AND public.has_shared_direct_conversation(auth.uid(), user_presence_state.user_id)
             )
           )
      )
    )
  );

DROP POLICY IF EXISTS presence_upsert_own ON public.user_presence_state;
CREATE POLICY presence_upsert_own
  ON public.user_presence_state
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Notification Preferences Policies
DROP POLICY IF EXISTS notif_prefs_own_all ON public.notification_preferences;
CREATE POLICY notif_prefs_own_all
  ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Conversations Policies
DROP POLICY IF EXISTS conversations_select_member ON public.conversations;
CREATE POLICY conversations_select_member
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(id, auth.uid()));

-- 5. Conversation Members Policies
DROP POLICY IF EXISTS conv_members_select_member ON public.conversation_members;
CREATE POLICY conv_members_select_member
  ON public.conversation_members
  FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid() AND left_at IS NULL)
    OR public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS conv_members_update_own_prefs ON public.conversation_members;
CREATE POLICY conv_members_update_own_prefs
  ON public.conversation_members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND left_at IS NULL)
  WITH CHECK (user_id = auth.uid() AND left_at IS NULL);

-- 6. Messages Policies
DROP POLICY IF EXISTS messages_select_member ON public.messages;
CREATE POLICY messages_select_member
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS messages_insert_member ON public.messages;
CREATE POLICY messages_insert_member
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND kind = 'user'
    AND deleted_at IS NULL
    AND public.can_send_to_conversation(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS messages_update_own ON public.messages;
CREATE POLICY messages_update_own
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id = auth.uid()
    AND kind = 'user'
    AND public.is_conversation_member(conversation_id, auth.uid())
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND kind = 'user'
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

-- 7. Attachments Policies
DROP POLICY IF EXISTS attachments_select_member ON public.attachments;
CREATE POLICY attachments_select_member
  ON public.attachments
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS attachments_insert_sender ON public.attachments;
CREATE POLICY attachments_insert_sender
  ON public.attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND public.can_send_to_conversation(conversation_id, auth.uid())
    AND EXISTS (
      SELECT 1
        FROM public.messages m
       WHERE m.id = attachments.message_id
         AND m.conversation_id = attachments.conversation_id
         AND m.sender_id = auth.uid()
         AND m.deleted_at IS NULL
    )
  );

-- 8. Message Receipts Policies
DROP POLICY IF EXISTS receipts_select_member ON public.message_receipts;
CREATE POLICY receipts_select_member
  ON public.message_receipts
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS receipts_insert_own ON public.message_receipts;
CREATE POLICY receipts_insert_own
  ON public.message_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS receipts_update_own ON public.message_receipts;
CREATE POLICY receipts_update_own
  ON public.message_receipts
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

-- 9. Message Reactions Policies
DROP POLICY IF EXISTS reactions_select_member ON public.message_reactions;
CREATE POLICY reactions_select_member
  ON public.message_reactions
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS reactions_insert_member ON public.message_reactions;
CREATE POLICY reactions_insert_member
  ON public.message_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_send_to_conversation(conversation_id, auth.uid())
    AND EXISTS (
      SELECT 1
        FROM public.messages m
       WHERE m.id = message_reactions.message_id
         AND m.conversation_id = message_reactions.conversation_id
         AND m.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS reactions_delete_own ON public.message_reactions;
CREATE POLICY reactions_delete_own
  ON public.message_reactions
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

-- 10. User Blocks Policies
DROP POLICY IF EXISTS blocks_select_own ON public.user_blocks;
CREATE POLICY blocks_select_own
  ON public.user_blocks
  FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS blocks_insert_own ON public.user_blocks;
CREATE POLICY blocks_insert_own
  ON public.user_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid() AND blocked_id <> auth.uid());

DROP POLICY IF EXISTS blocks_delete_own ON public.user_blocks;
CREATE POLICY blocks_delete_own
  ON public.user_blocks
  FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());

-- 11. Reports Policies
DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- 12. Private Supabase Storage Buckets & Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
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

-- Storage Objects Policies: Avatars (private bucket, authenticated read via signed URL, strict user-folder write)
DROP POLICY IF EXISTS avatars_select_authenticated ON storage.objects;
CREATE POLICY avatars_select_authenticated
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Objects Policies: Chat Attachments (private bucket, strictly gated by active conversation membership)
DROP POLICY IF EXISTS chat_attachments_select_member ON storage.objects;
CREATE POLICY chat_attachments_select_member
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.is_conversation_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS chat_attachments_insert_member ON storage.objects;
CREATE POLICY chat_attachments_insert_member
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.can_send_to_conversation(((storage.foldername(name))[1])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS chat_attachments_delete_own ON storage.objects;
CREATE POLICY chat_attachments_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Configure Supabase Realtime publication tables idempotently
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'profiles',
    'conversations',
    'conversation_members',
    'messages',
    'attachments',
    'message_receipts',
    'message_reactions'
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
