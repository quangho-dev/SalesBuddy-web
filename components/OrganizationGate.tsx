"use client";

import { useAuth } from "@clerk/nextjs";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { organizationLabel, useCurrentAccount, vietnameseRole } from "@/components/CurrentAccount";
import { getCurrentUser, joinOrganization } from "@/lib/api";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60 dark:border-white/20 dark:focus:border-primary";

export function OrganizationGate({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { setOrganizationLabel, setRoleLabel } = useCurrentAccount();
  const [phase, setPhase] = useState<"loading" | "needed" | "ready" | "error">("loading");
  const [name, setName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Bạn cần đăng nhập lại.");
      const user = await getCurrentUser(token);
      setOrganizationLabel(organizationLabel(user.organization));
      setRoleLabel(vietnameseRole(user.role));
      setPhase(user.organization_id ? "ready" : "needed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không kiểm tra được tổ chức.");
      setPhase("error");
    }
  }, [getToken, setOrganizationLabel, setRoleLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    const nextTaxCode = taxCode.trim();
    if (!nextName && !nextTaxCode) {
      setError("Hãy nhập tên tổ chức hoặc mã số thuế.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Bạn cần đăng nhập lại.");
      const user = await joinOrganization(token, {
        name: nextName,
        tax_code: nextTaxCode,
      });
      setOrganizationLabel(organizationLabel(user.organization));
      setRoleLabel(vietnameseRole(user.role));
      setPhase(user.organization_id ? "ready" : "needed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gắn được tổ chức.");
    } finally {
      setSaving(false);
    }
  }

  if (phase === "ready") return children;

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="w-full max-w-md rounded-2xl border border-black/10 p-6 dark:border-white/15"
      >
        <h1 className="text-lg font-semibold tracking-tight">Tổ chức của bạn</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Nhập tên tổ chức hoặc mã số thuế để gắn tài khoản vào đúng công ty. Nếu tổ chức đã có, tài khoản sẽ vào tổ chức đó.
        </p>
        {phase === "loading" ? (
          <p className="mt-6 text-sm text-black/55 dark:text-white/55">Đang kiểm tra tổ chức...</p>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Tên tổ chức
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                disabled={saving}
                autoComplete="organization"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Mã số thuế
              <input
                value={taxCode}
                onChange={(event) => setTaxCode(event.target.value)}
                className={inputClass}
                disabled={saving}
              />
            </label>
            {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
            <div className="flex items-center justify-end gap-2">
              {phase === "error" ? (
                <button
                  type="button"
                  onClick={() => void load()}
                  className="h-10 rounded-lg border border-black/15 px-4 text-sm dark:border-white/20"
                >
                  Thử lại
                </button>
              ) : null}
              <button
                type="submit"
                disabled={saving || phase === "error"}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Tiếp tục"}
              </button>
            </div>
          </div>
        )}
      </form>
    </main>
  );
}
