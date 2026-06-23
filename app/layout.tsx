import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import { auth } from "@/auth";
import { AppSidebar, type SidebarUser } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });
// Body typeface for the invoice document.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-invoice-serif",
});

export const metadata: Metadata = {
  title: "GY6 Finance Management System",
  description: "Internal financial operations and accounting platform for GY6.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Reading the session here makes the root layout dynamic, which propagates
  // to every route. Acceptable - this is an internal app where every page
  // already opts into force-dynamic.
  const session = await auth();
  const sidebarUser: SidebarUser | null = session?.user
    ? {
        name: session.user.name ?? "",
        email: session.user.email ?? "",
      }
    : null;

  return (
    <html
      lang="en"
      className={cn("font-sans", sans.variable, sourceSerif.variable)}
    >
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen">
          <AppSidebar user={sidebarUser} />
          <main className="flex-1 overflow-x-auto">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
