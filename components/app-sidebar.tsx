"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Accounts", href: "/accounts" },
  { label: "Categories", href: "/categories" },
  { label: "Income", href: "/income" },
  { label: "Expenses", href: "/expenses" },
  { label: "Transfers", href: "/transfers" },
  { label: "Distributions", href: "/distributions" },
  { label: "Renewals", href: "/renewals" },
  { label: "Ledger", href: "/ledger" },
  { label: "Notes", href: "/notes" },
];

export interface SidebarUser {
  name: string;
  email: string;
}

interface AppSidebarProps {
  user: SidebarUser | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  // The login page renders its own centered layout; skip the sidebar there.
  if (pathname === "/login") return null;

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut({ redirect: true, callbackUrl: "/login" });
    } finally {
      // signOut redirects so this rarely fires, but reset in case the
      // navigation is intercepted.
      setSigningOut(false);
    }
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="px-6 py-5">
        <h1 className="text-lg font-semibold tracking-tight">GY6 Finance</h1>
        <p className="text-xs text-muted-foreground">Internal accounting</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 pb-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-sidebar-border/50 px-4 py-4">
          <div className="mb-3 overflow-hidden">
            <p className="truncate text-sm font-medium leading-tight">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      )}
    </aside>
  );
}
