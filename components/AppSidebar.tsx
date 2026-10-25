"use client";

import { UserButton } from "@clerk/nextjs";
import {
  CreditCard,
  FileText,
  MessageSquare,
  Package,
  Settings,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AppSidebarProps = {
  onNavigate?: () => void;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  {
    href: "/chat",
    label: "Chat",
    icon: MessageSquare,
    match: (pathname) => pathname === "/chat",
  },
  {
    href: "/customers",
    label: "Khách hàng",
    icon: Users,
    match: (pathname) => pathname.startsWith("/customers"),
  },
  {
    href: "/products",
    label: "Sản phẩm",
    icon: Package,
    match: (pathname) => pathname.startsWith("/products"),
  },
  {
    href: "/quotes",
    label: "Báo giá",
    icon: FileText,
    match: (pathname) => pathname.startsWith("/quotes"),
  },
  {
    href: "/orders",
    label: "Đơn hàng",
    icon: ShoppingCart,
    match: (pathname) => pathname.startsWith("/orders"),
  },
  {
    href: "/debts",
    label: "Công nợ",
    icon: CreditCard,
    match: (pathname) => pathname.startsWith("/debts"),
  },
  {
    href: "/settings",
    label: "Cài đặt",
    icon: Settings,
    match: (pathname) => pathname.startsWith("/settings"),
  },
];

function navItemClass(active: boolean) {
  return [
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
    active
      ? "bg-black text-white dark:bg-white dark:text-black"
      : "text-black/80 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10",
  ].join(" ");
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-black/10 bg-black/2 dark:border-white/10 dark:bg-white/3">
      <div className="border-b border-black/10 px-4 py-4 dark:border-white/10">
        <Link
          href="/chat"
          onClick={onNavigate}
          className="text-sm font-semibold tracking-tight"
        >
          Sales Buddy
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={navItemClass(item.match(pathname))}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
        <UserButton />
      </div>
    </aside>
  );
}
