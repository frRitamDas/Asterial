/**
 * Phase 2+ React Native navigation route parameter contracts.
 * Defined in Phase 1 so upcoming native messaging & social screens share strict
 * compile-time route signatures.
 */
export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ResetPassword: undefined;
  Onboarding: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  Explore: undefined;
  Chats: undefined;
  Notifications: undefined;
  Profile: { username?: string } | undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  ConversationThread: { conversationId: string };
  GroupCreate: undefined;
  PostComposer: { replyToPostId?: string } | undefined;
  PostDetail: { postId: string };
  Settings: undefined;
};
