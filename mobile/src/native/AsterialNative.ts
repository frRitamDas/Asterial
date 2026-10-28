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

interface RawAsterialNativeModule {
  pickMediaOrDocument(options: {
    kind: "avatar" | "attachment";
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
  async pickMediaOrDocument(
    kind: "avatar" | "attachment"
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
