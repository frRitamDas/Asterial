-- Allow uploaders to delete their own chat attachments via the Supabase Storage API during account/message cleanup
DROP POLICY IF EXISTS "chat_attachments_delete_own" ON storage.objects;
CREATE POLICY "chat_attachments_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Update delete_own_account() so it transfers group ownership, wipes sent message bodies,
-- and deletes auth.users cleanly without triggering storage.protect_delete() on storage.objects
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

  -- Delete auth.users record (cascades to profiles, memberships, attachments rows, preferences, blocks, etc.)
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
