"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AppSidebarProps = {
  onNavigate?: () => void;
};

function navItemClass(active: boolean) {
  return [
    "block rounded-lg px-3 py-2 text-sm",
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
        <Link
          href="/chat"
          onClick={onNavigate}
          className={navItemClass(pathname === "/chat")}
        >
          Chat
        </Link>
        <Link
          href="/customers"
          onClick={onNavigate}
          className={navItemClass(pathname.startsWith("/customers"))}
        >
          Khách hàng
        </Link>
        <Link
          href="/products"
          onClick={onNavigate}
          className={navItemClass(pathname.startsWith("/products"))}
        >
          Sản phẩm
        </Link>
        <Link
          href="/orders"
          onClick={onNavigate}
          className={navItemClass(pathname.startsWith("/orders"))}
        >
          Đơn hàng
        </Link>
        <Link
          href="/quotes"
          onClick={onNavigate}
          className={navItemClass(pathname.startsWith("/quotes"))}
        >
          Báo giá
        </Link>
      </nav>

      <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
        <UserButton />
      </div>
    </aside>
  );
}
