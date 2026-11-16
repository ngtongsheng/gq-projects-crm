import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = { title: `Privacy · ${APP_NAME}` };

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Privacy notice</CardTitle>
          <CardDescription>
            {APP_NAME} is the internal app of GQ Projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <section className="flex flex-col gap-1">
            <h2 className="font-heading font-medium">Who runs it</h2>
            <p>
              GQ Projects runs {APP_NAME} for its own staff. Only people the
              company has added can sign in. It is not open to the public.
            </p>
          </section>
          <section className="flex flex-col gap-1">
            <h2 className="font-heading font-medium">What is stored</h2>
            <p>
              Each person's name and work email, and the work records the team
              enters: customers, projects, stock, leave, claims and similar.
              This information stays inside the company and is used only to run
              the business.
            </p>
          </section>
          <section className="flex flex-col gap-1">
            <h2 className="font-heading font-medium">Google sign-in</h2>
            <p>
              People sign in with their Google account. {APP_NAME} receives only
              the email address and name on that account. It does not read mail,
              files, contacts or anything else in Google.
            </p>
          </section>
          <section className="flex flex-col gap-1">
            <h2 className="font-heading font-medium">Questions or removal</h2>
            <p>
              To see, correct or remove your information, contact GQ Projects
              directly.
            </p>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
