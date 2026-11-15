import type { createClient } from "@/lib/supabase/server";

// Error codes raised by hand_over_work() in the resignation handover migration.
const MESSAGES: Record<string, string> = {
  "42501": "Only an admin can hand over work.",
  "22023": "Choose someone else who still works here to receive their work.",
  "55000": "Mark them as left before handing over their work.",
};

/**
 * Moves a leaver's customers and open projects to one person in one go and records the
 * handover list. Commission on their MOFs stays with them (loop 16 D5).
 */
export async function handOverWork(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leaverId: string,
  recipientId: string,
): Promise<string | null> {
  const { error } = await supabase.rpc("hand_over_work", {
    leaver: leaverId,
    recipient: recipientId,
  });
  if (!error) return null;
  const message = MESSAGES[error.code];
  if (message) return message;
  console.error("Could not hand over work", error);
  return "Could not hand over their work. Try again.";
}
