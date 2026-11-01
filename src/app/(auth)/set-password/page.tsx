import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_NAME } from "@/lib/app-name";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: `Set your password · ${APP_NAME}` };

export default async function SetPasswordPage({
  searchParams,
}: PageProps<"/set-password">) {
  const { token_hash: tokenHash, type } = await searchParams;
  const validLink =
    typeof tokenHash === "string" &&
    tokenHash !== "" &&
    (type === "invite" || type === "recovery");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{APP_NAME}</CardTitle>
          <CardDescription>
            {validLink
              ? "Choose a password to finish setting up your account."
              : "This link isn't complete. Ask your admin to send it again."}
          </CardDescription>
        </CardHeader>
        {validLink ? (
          <CardContent>
            <SetPasswordForm tokenHash={tokenHash} type={type} />
          </CardContent>
        ) : null}
      </Card>
    </main>
  );
}
