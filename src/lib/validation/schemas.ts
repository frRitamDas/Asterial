export * from "@asterial/core/validation/schemas";
import { validateUploadMetadataAndHeader } from "@asterial/core/validation/schemas";

export async function validateUploadFile(
  file: File,
  kind: "avatar" | "attachment" | "social-image" | "social-media"
): Promise<{ ok: true; verifiedMime: string } | { ok: false; error: string }> {
  const headerBuffer = await file.slice(0, 32).arrayBuffer();
  const headerBytes = new Uint8Array(headerBuffer);
  return validateUploadMetadataAndHeader({
    fileName: file.name,
    byteSize: file.size,
    declaredMime: file.type,
    headerBytes,
    kind,
  });
}
