export type MainTabKey =
  | "chats"
  | "groups"
  | "orbits"
  | "moments"
  | "feed"
  | "contacts"
  | "profile"
  | "settings";

export type MobileBootStatus =
  | "booting"
  | "unconfigured"
  | "signed_out"
  | "password_recovery"
  | "onboarding"
  | "ready";

export interface ToastMessage {
  id: number;
  kind: "info" | "success" | "error";
  text: string;
}
