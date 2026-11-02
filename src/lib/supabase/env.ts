function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

/**
 * Read at request time, not module load, so `next build` works without env.
 * Referenced literally so Next.js can inline them into the browser bundle.
 */
export function supabaseEnv() {
  return {
    url: required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    publishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}
