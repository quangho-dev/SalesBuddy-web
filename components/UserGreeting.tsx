"use client";

import { useUser } from "@clerk/nextjs";
import { useCurrentAccount } from "@/components/CurrentAccount";

export function UserGreeting({ variant = "header" }: { variant?: "header" | "sidebar" }) {
  const { user } = useUser();
  const { organizationLabel, roleLabel } = useCurrentAccount();
  const name =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    "";
  if (!name) return null;

  const nameClass =
    variant === "sidebar"
      ? "text-sm font-medium whitespace-normal break-words text-white"
      : "text-sm font-medium whitespace-normal break-words text-black dark:text-white";
  const orgClass =
    variant === "sidebar"
      ? "text-xs whitespace-normal break-words text-white/70"
      : "text-xs whitespace-normal break-words text-black/55 dark:text-white/55";

  return (
    <div className="min-w-0">
      <p className={nameClass}>Xin chào {name}</p>
      {roleLabel ? <p className={orgClass}>{roleLabel}</p> : null}
      {organizationLabel ? <p className={orgClass}>{organizationLabel}</p> : null}
    </div>
  );
}
