import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid https URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
});

export function getPublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid ASTERIAL public environment configuration: ${parsed.error.issues
        .map((i) => i.message)
        .join(", ")}`
    );
  }

  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    appUrl: parsed.data.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };
}

export function getServerServiceRoleKey(): string | null {
  if (typeof window !== "undefined") {
    throw new Error("Server credentials cannot be accessed in browser context.");
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key && key.trim().length > 20 ? key.trim() : null;
}
