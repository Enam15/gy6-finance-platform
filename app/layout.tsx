import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "GY6 Finance Management System",
  description: "Internal financial operations and accounting platform for GY6.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="flex-1 overflow-x-auto">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
