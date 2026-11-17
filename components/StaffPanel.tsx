"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { listSalesStaff, type SalesStaffMember } from "@/lib/api";
import Link from "next/link";

function staffName(member: SalesStaffMember) {
  return (member.name || "").trim();
}

function staffEmail(member: SalesStaffMember) {
  return (member.email || "").trim() || "Nhân viên chưa có email";
}

function customerCountLabel(count: number) {
  return count === 1 ? "1 khách hàng" : `${count} khách hàng`;
}

export function StaffPanel() {
  const { getToken } = useAuth();
  const [staff, setStaff] = useState<SalesStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
      setStaff(await listSalesStaff(token));
    } catch (err) {
      setStaff([]);
      setError(err instanceof Error ? err.message : "Không tải được danh sách nhân viên.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-black/10 px-6 py-4 dark:border-white/10">
        <h1 className="text-lg font-semibold tracking-tight">Nhân viên</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Danh sách nhân viên sales trong cùng tổ chức.
        </p>
      </header>

      {error ? (
        <p className="border-b border-red-300 bg-red-50 px-6 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <p className="text-sm text-black/55 dark:text-white/55">Đang tải...</p>
        ) : error ? null : staff.length === 0 ? (
          <p className="text-sm text-black/55 dark:text-white/55">
            Chưa có nhân viên sales trong tổ chức.
          </p>
        ) : (
          <ul className="mx-auto flex w-full max-w-3xl flex-col gap-3">
            {staff.map((member) => (
              <li
                key={member.clerk_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3 dark:border-white/15"
              >
                <div className="min-w-0">
                  {staffName(member) ? (
                    <p className="whitespace-normal break-words text-sm font-medium">
                      {staffName(member)}
                    </p>
                  ) : null}
                  <p
                    className={
                      staffName(member)
                        ? "mt-0.5 whitespace-normal break-words text-xs text-black/55 dark:text-white/55"
                        : "whitespace-normal break-words text-sm font-medium"
                    }
                  >
                    {staffEmail(member)}
                  </p>
                  <p className="mt-1 text-xs text-black/55 dark:text-white/55">
                    Nhân viên sales · {customerCountLabel(member.customer_count)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/quotes?owner=${encodeURIComponent(member.clerk_id)}`}
                    className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/[0.04]"
                  >
                    Xem báo giá
                  </Link>
                  <Link
                    href={`/orders?owner=${encodeURIComponent(member.clerk_id)}`}
                    className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/[0.04]"
                  >
                    Xem đơn hàng
                  </Link>
                  <Link
                    href={`/customers?owner=${encodeURIComponent(member.clerk_id)}`}
                    className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/[0.04]"
                  >
                    Xem khách hàng
                  </Link>
                  <Link
                    href={`/debts?owner=${encodeURIComponent(member.clerk_id)}`}
                    className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/[0.03] dark:border-white/20 dark:hover:bg-white/[0.04]"
                  >
                    Xem công nợ
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
