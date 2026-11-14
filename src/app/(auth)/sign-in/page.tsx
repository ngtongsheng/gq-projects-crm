import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { APP_NAME } from "@/lib/app-name";
import {
  isSignInRefusal,
  SIGN_IN_REFUSAL_MESSAGE,
} from "@/lib/auth/sign-in-decision";
import { signInWithGoogle } from "./actions";
import { GoogleSignInButton } from "./google-sign-in-button";

export const metadata: Metadata = { title: `Sign in · ${APP_NAME}` };

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const params = await searchParams;
  // `left=1` comes from the /left route, `refused` from the Google callback.
  const refusal =
    params.left === "1"
      ? "left"
      : isSignInRefusal(params.refused)
        ? params.refused
        : null;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{APP_NAME}</CardTitle>
          <CardDescription>
            Sign in with the Google account your admin added.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {refusal && (
            <FieldError>{SIGN_IN_REFUSAL_MESSAGE[refusal]}</FieldError>
          )}
          <form action={signInWithGoogle}>
            <GoogleSignInButton />
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
