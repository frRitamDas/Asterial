"use client";

import {
  getCachedSignedUrl,
  measureImageDimensions,
  primeAvatarSignedUrls,
  primeBucketSignedUrls,
  resolveSignedUrl,
  uploadAvatarFile,
  uploadConversationAttachment,
  uploadSocialMediaFile,
  type PrivateBucketId,
} from "@/lib/supabase/storage";

export type { PrivateBucketId };

export const mediaService = {
  getCachedSignedUrl,
  resolveSignedUrl,
  primeBucketSignedUrls,
  primeAvatarSignedUrls,
  measureImageDimensions,
  uploadAvatarFile,
  uploadConversationAttachment,
  uploadSocialMediaFile,
};
