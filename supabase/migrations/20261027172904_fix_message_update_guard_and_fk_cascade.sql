CREATE OR REPLACE FUNCTION public.before_message_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Permit PostgreSQL foreign-key ON DELETE SET NULL cascades (e.g. account deletion setting sender_id = NULL)
  IF pg_trigger_depth() > 1
     AND NEW.id = OLD.id
     AND NEW.conversation_id = OLD.conversation_id
     AND NEW.kind = OLD.kind
     AND NEW.body = OLD.body
     AND (NEW.sender_id IS NOT DISTINCT FROM OLD.sender_id OR NEW.sender_id IS NULL)
     AND (NEW.reply_to_id IS NOT DISTINCT FROM OLD.reply_to_id OR NEW.reply_to_id IS NULL) THEN
    RETURN NEW;
  END IF;

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

  -- Soft-deletion wipes plaintext content and removes attachment metadata rows
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.body := '';
    NEW.has_attachments := false;
    NEW.edited_at := NULL;
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
