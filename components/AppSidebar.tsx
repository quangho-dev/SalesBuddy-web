"use client";

import { UserButton } from "@clerk/nextjs";
import {
  CreditCard,
  FileText,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AppSidebarProps = {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
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
    label: "Trợ lý Sales",
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

function navItemClass(active: boolean, collapsed: boolean) {
  return [
    "flex items-center rounded-lg py-2 text-sm",
    collapsed ? "justify-center px-2" : "gap-2.5 px-3",
    active
      ? "bg-black text-white dark:bg-white dark:text-black"
      : "text-black/80 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10",
  ].join(" ");
}

export function AppSidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-black/10 bg-black/2 transition-[width] duration-200 dark:border-white/10 dark:bg-white/3 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div
        className={`flex items-center border-b border-black/10 dark:border-white/10 ${
          collapsed ? "justify-center px-2 py-3" : "justify-between gap-2 px-4 py-4"
        }`}
      >
        {collapsed ? null : (
          <Link
            href="/chat"
            onClick={onNavigate}
            className="text-sm font-semibold tracking-tight"
          >
            Sales Buddy
          </Link>
        )}
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
            title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
            className="rounded-md p-1.5 text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        ) : null}
      </div>

      <nav className={`flex flex-1 flex-col gap-1 ${collapsed ? "p-2" : "p-3"}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              className={navItemClass(item.match(pathname), collapsed)}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {collapsed ? null : item.label}
            </Link>
          );
        })}
      </nav>

      <div
        className={`border-t border-black/10 py-3 dark:border-white/10 ${
          collapsed ? "flex justify-center px-2" : "px-4"
        }`}
      >
        <UserButton />
      </div>
    </aside>
  );
}
