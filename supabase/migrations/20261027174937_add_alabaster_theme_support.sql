-- Reversible schema enhancement for ASTERIAL v1.2.0:
-- Expand notification_preferences.appearance_theme check constraint to permit the balanced 'alabaster' light theme
-- while preserving 'obsidian' (default), 'pitch', and 'graphite' and keeping all existing user rows untouched.

ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notif_prefs_theme_chk;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notif_prefs_theme_chk
  CHECK (appearance_theme IN ('obsidian', 'pitch', 'graphite', 'alabaster'));
