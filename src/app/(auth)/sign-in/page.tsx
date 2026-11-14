import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_NAME } from "@/lib/app-name";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: `Sign in · ${APP_NAME}` };

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  // Set by the /left route after signing out someone who has left the company.
  const left = (await searchParams).left === "1";

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{APP_NAME}</CardTitle>
          <CardDescription>
            {left
              ? "You no longer have access. Ask your admin if this is a mistake."
              : "Sign in with the email and password your admin gave you."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    </main>
  );
}
