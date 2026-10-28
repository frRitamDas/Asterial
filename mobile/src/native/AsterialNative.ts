import { DeviceEventEmitter, NativeModules } from "react-native";
import { ASTERIAL_BRAND } from "@asterial/core";

export interface PickedNativeDocument {
  uri: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  headerBytes: number[];
  width: number | null;
  height: number | null;
}

export interface NativeUploadOptions {
  uploadId: string;
  uri: string;
  uploadUrl: string;
  anonKey: string;
  accessToken: string;
  mimeType: string;
  upsert: boolean;
  totalBytes: number;
}

export interface NativeUploadProgressEvent {
  uploadId: string;
  bytesSent: number;
  totalBytes: number;
  percent: number;
}

export interface InstalledAndroidAppInfo {
  applicationId: string;
  versionName: string;
  baseVersionName: string;
  versionCode: number;
  isDebugBuild: boolean;
}

export interface NativeHttpsRequestOptions {
  url: string;
  method: string;
  headersJson: string;
  body?: string | null;
  timeoutMs?: number;
}

export interface NativeHttpsResponsePayload {
  status: number;
  ok: boolean;
  statusText: string;
  headersJson: string;
  bodyText: string;
}

interface RawAsterialNativeModule {
  getSecureItem(key: string): Promise<string | null>;
  setSecureItem(key: string, value: string): Promise<boolean>;
  removeSecureItem(key: string): Promise<boolean>;
  clearSecureStorage(): Promise<boolean>;
  nativeHttpsRequest(
    options: NativeHttpsRequestOptions
  ): Promise<NativeHttpsResponsePayload>;
  pickMediaOrDocument(options: {
    kind: "avatar" | "attachment" | "social-image";
  }): Promise<PickedNativeDocument | null>;
  uploadUriToSupabaseStorage(
    options: NativeUploadOptions
  ): Promise<{ ok: boolean; status: number; bytesSent: number }>;
  cancelUpload(uploadId: string): Promise<boolean>;
  copyText(text: string): Promise<boolean>;
  getNetworkState(): Promise<{ isOnline: boolean }>;
  getInstalledAppInfo(): Promise<InstalledAndroidAppInfo>;
}

function getRawModule(): RawAsterialNativeModule | null {
  const mod = NativeModules.AsterialNative as
    | RawAsterialNativeModule
    | undefined;
  return mod || null;
}

export const AsterialNative = {
  hasNativeHttpsBridge(): boolean {
    const mod = getRawModule();
    return Boolean(mod && typeof mod.nativeHttpsRequest === "function");
  },

  async getSecureItem(key: string): Promise<string | null> {
    const mod = getRawModule();
    if (!mod || typeof mod.getSecureItem !== "function") return null;
    return mod.getSecureItem(key);
  },

  async setSecureItem(key: string, value: string): Promise<boolean> {
    const mod = getRawModule();
    if (!mod || typeof mod.setSecureItem !== "function") return false;
    return mod.setSecureItem(key, value);
  },

  async removeSecureItem(key: string): Promise<boolean> {
    const mod = getRawModule();
    if (!mod || typeof mod.removeSecureItem !== "function") return false;
    return mod.removeSecureItem(key);
  },

  async clearSecureStorage(): Promise<boolean> {
    const mod = getRawModule();
    if (!mod || typeof mod.clearSecureStorage !== "function") return false;
    return mod.clearSecureStorage();
  },

  async nativeHttpsRequest(
    options: NativeHttpsRequestOptions
  ): Promise<NativeHttpsResponsePayload> {
    const mod = getRawModule();
    if (!mod || typeof mod.nativeHttpsRequest !== "function") {
      throw new Error("Native HTTPS bridge is unavailable.");
    }
    return mod.nativeHttpsRequest(options);
  },

  async pickMediaOrDocument(
    kind: "avatar" | "attachment" | "social-image"
  ): Promise<PickedNativeDocument | null> {
    const mod = getRawModule();
    if (!mod) {
      throw new Error(
        "Native Android file picker module is unavailable in this build."
      );
    }
    return mod.pickMediaOrDocument({ kind });
  },

  async uploadUriToSupabaseStorage(
    options: NativeUploadOptions
  ): Promise<{ ok: boolean; status: number; bytesSent: number }> {
    const mod = getRawModule();
    if (!mod) {
      throw new Error(
        "Native Android storage upload bridge is unavailable in this build."
      );
    }
    return mod.uploadUriToSupabaseStorage(options);
  },

  async cancelUpload(uploadId: string): Promise<boolean> {
    const mod = getRawModule();
    if (!mod) return false;
    return mod.cancelUpload(uploadId);
  },

  async copyText(text: string): Promise<boolean> {
    const mod = getRawModule();
    if (!mod) return false;
    return mod.copyText(text);
  },

  async getNetworkState(): Promise<boolean> {
    const mod = getRawModule();
    if (!mod) return true;
    try {
      const res = await mod.getNetworkState();
      return Boolean(res.isOnline);
    } catch {
      return true;
    }
  },

  async getInstalledAppInfo(): Promise<InstalledAndroidAppInfo> {
    const mod = getRawModule();
    if (!mod) {
      return {
        applicationId: ASTERIAL_BRAND.androidPackageId,
        versionName: ASTERIAL_BRAND.semver,
        baseVersionName: ASTERIAL_BRAND.semver,
        versionCode: ASTERIAL_BRAND.versionCode,
        isDebugBuild: false,
      };
    }
    try {
      return await mod.getInstalledAppInfo();
    } catch {
      return {
        applicationId: ASTERIAL_BRAND.androidPackageId,
        versionName: ASTERIAL_BRAND.semver,
        baseVersionName: ASTERIAL_BRAND.semver,
        versionCode: ASTERIAL_BRAND.versionCode,
        isDebugBuild: false,
      };
    }
  },

  onUploadProgress(
    uploadId: string,
    listener: (event: NativeUploadProgressEvent) => void
  ): () => void {
    const sub = DeviceEventEmitter.addListener(
      "asterialUploadProgress",
      (payload: NativeUploadProgressEvent) => {
        if (payload?.uploadId === uploadId) {
          listener(payload);
        }
      }
    );
    return () => sub.remove();
  },

  onNetworkStateChange(listener: (isOnline: boolean) => void): () => void {
    const sub = DeviceEventEmitter.addListener(
      "asterialNetworkState",
      (payload: { isOnline?: boolean }) => {
        if (typeof payload?.isOnline === "boolean") {
          listener(payload.isOnline);
        }
      }
    );
    return () => sub.remove();
  },
};
