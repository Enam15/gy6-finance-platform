"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BookText,
  LayoutGrid,
  PieChart,
  ReceiptText,
  RefreshCw,
  StickyNote,
  Tags,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutGrid },
  { label: "Accounts", href: "/accounts", icon: Wallet },
  { label: "Categories", href: "/categories", icon: Tags },
  { label: "Income", href: "/income", icon: ArrowDownLeft },
  { label: "Expenses", href: "/expenses", icon: ArrowUpRight },
  { label: "Transfers", href: "/transfers", icon: ArrowLeftRight },
  { label: "Distributions", href: "/distributions", icon: PieChart },
  { label: "Renewals", href: "/renewals", icon: RefreshCw },
  { label: "Ledger", href: "/ledger", icon: BookText },
  { label: "Invoices", href: "/invoices", icon: ReceiptText },
  { label: "Notes", href: "/notes", icon: StickyNote },
];

export interface SidebarUser {
  name: string;
  email: string;
}

interface AppSidebarProps {
  user: SidebarUser | null;
}

function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return letters.toUpperCase() || "GY";
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
      setSigningOut(false);
    }
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground print:hidden">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm shadow-primary/30">
          G6
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">GY6 Finance</p>
          <p className="text-xs text-muted-foreground">Internal accounting</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border px-3 py-4">
        {user && (
          <div className="mb-1 flex items-center gap-2.5 px-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {initialsOf(user.name)}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-medium leading-tight">
                {user.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        )}
        <ThemeToggle className="w-full" />
        {user && (
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
        )}
      </div>
    </aside>
  );
}
