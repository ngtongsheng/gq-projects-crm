import type { Metadata } from "next";
import { Figtree, IBM_Plex_Mono, Saira } from "next/font/google";
import { DevRolePanel } from "@/components/app/dev-role-panel";
import { ThemeProvider } from "@/components/app/theme-provider";
import { ThemeScript } from "@/components/app/theme-script";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_NAME } from "@/lib/app-name";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const saira = Saira({ variable: "--font-saira", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Internal CRM for GQ Projects",
};

/** Reads who is signed in only under `pnpm dev`, so built pages stay static. */
async function DevRolePanelSlot() {
  const profile = await getCurrentProfile();
  return (
    <DevRolePanel
      currentId={profile?.id ?? null}
      currentRole={profile?.jobRole ?? null}
    />
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${saira.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
          {process.env.NODE_ENV === "development" && <DevRolePanelSlot />}
        </ThemeProvider>
      </body>
    </html>
  );
}
