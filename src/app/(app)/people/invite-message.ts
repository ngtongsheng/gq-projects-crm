import { APP_NAME } from "@/lib/app-name";

/** Ready-to-paste WhatsApp text for the one-time set-password link. */
export function inviteMessage(fullName: string, link: string): string {
  return [
    `Hi ${fullName}, you've been added to ${APP_NAME}.`,
    "Open this link to set your password (it works once):",
    link,
  ].join("\n");
}

export type Invite = {
  link: string;
  message: string;
  /** Opens WhatsApp with the message ready to send; null when no mobile number is known. */
  whatsappUrl: string | null;
};

/** The link, the message around it and, with a mobile number (digits with 60), a WhatsApp shortcut. */
export function buildInvite(
  fullName: string,
  link: string,
  mobile: string | null,
): Invite {
  const message = inviteMessage(fullName, link);
  return {
    link,
    message,
    whatsappUrl: mobile
      ? `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`
      : null,
  };
}
