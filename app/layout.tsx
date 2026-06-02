import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { auth } from "@/auth";
import { AppSidebar, type SidebarUser } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

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
    <html lang="en" className={cn("font-sans", geist.variable)}>
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
