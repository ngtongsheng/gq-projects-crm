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

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{APP_NAME}</CardTitle>
          <CardDescription>
            Sign in with the email and password your admin gave you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    </main>
  );
}
