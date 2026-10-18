"use client";

import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { AppSidebar } from "@/components/AppSidebar";
import { usePathname } from "next/navigation";
import { useState } from "react";

function SignedInShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="hidden h-full md:block">
        <AppSidebar />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Đóng menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 h-full">
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3 md:hidden dark:border-white/10">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/20"
          >
            Menu
          </button>
          <span className="text-sm font-semibold tracking-tight">Sales Buddy</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage =
    pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
    <Show
      when="signed-in"
      fallback={
        <>
          <header className="flex items-center justify-between gap-3 border-b border-black/10 px-6 py-3 dark:border-white/10">
            <a href="/" className="text-sm font-semibold tracking-tight">
              Sales Buddy
            </a>
            <div className="flex items-center gap-3">
              <SignInButton />
              <SignUpButton />
            </div>
          </header>
          {children}
        </>
      }
    >
      <SignedInShell>{children}</SignedInShell>
    </Show>
    </div>
  );
}
