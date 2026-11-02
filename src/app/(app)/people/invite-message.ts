import { APP_NAME } from "@/lib/app-name";

/** Ready-to-paste WhatsApp text for the one-time set-password link. */
export function inviteMessage(fullName: string, link: string): string {
  return [
    `Hi ${fullName}, you've been added to ${APP_NAME}.`,
    "Open this link to set your password (it works once):",
    link,
  ].join("\n");
}
