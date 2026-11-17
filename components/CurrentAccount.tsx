"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Organization } from "@/lib/api";

type CurrentAccountValue = {
  organizationLabel: string;
  setOrganizationLabel: (value: string) => void;
  role: string;
  setRole: (value: string) => void;
  roleLabel: string;
  setRoleLabel: (value: string) => void;
};

const CurrentAccountContext = createContext<CurrentAccountValue | null>(null);

export function organizationLabel(organization?: Organization | null) {
  return organization?.name.trim() || organization?.tax_code.trim() || "";
}

export function vietnameseRole(role?: string | null) {
  if (role === "sales_supervisor") return "Quản lý sales";
  if (role === "sales_representative") return "Nhân viên sales";
  return "";
}

export function CurrentAccountProvider({ children }: { children: React.ReactNode }) {
  const [organizationLabel, setOrganizationLabel] = useState("");
  const [role, setRole] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const value = useMemo(
    () => ({ organizationLabel, setOrganizationLabel, role, setRole, roleLabel, setRoleLabel }),
    [organizationLabel, role, roleLabel],
  );
  return (
    <CurrentAccountContext.Provider value={value}>{children}</CurrentAccountContext.Provider>
  );
}

export function useCurrentAccount() {
  const value = useContext(CurrentAccountContext);
  if (!value) {
    throw new Error("useCurrentAccount must be used inside CurrentAccountProvider");
  }
  return value;
}
