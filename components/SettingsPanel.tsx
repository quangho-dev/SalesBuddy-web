"use client";

import { useAuth } from "@clerk/nextjs";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getSettings, updateSettings } from "@/lib/api";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-60 dark:border-white/20 dark:focus:border-white/50";

const FALLBACK_DAYS = "3";

export function SettingsPanel() {
  const { getToken } = useAuth();
  const [days, setDays] = useState(FALLBACK_DAYS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const withToken = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
    }
    return token;
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const token = await withToken();
        const settings = await getSettings(token);
        if (!cancelled) {
          setDays(String(settings.default_payment_term_days ?? 3));
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Không tải được cài đặt.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [withToken]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(days);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Hạn công nợ phải là số ngày từ 0 trở lên.");
      return;
    }
    const nextDays = Math.round(parsed);
    setSaving(true);
    try {
      const token = await withToken();
      const saved = await updateSettings(token, {
        default_payment_term_days: nextDays,
      });
      setDays(String(saved.default_payment_term_days));
      toast.success("Đã lưu hạn công nợ mặc định.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được cài đặt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-black/10 px-6 py-4 dark:border-white/10">
        <h1 className="text-lg font-semibold tracking-tight">Cài đặt</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Giá trị dùng chung khi tạo khách hàng mới.
        </p>
      </header>

      <form onSubmit={(event) => void onSave(event)} className="max-w-xl p-6">
        <label className="flex flex-col gap-1 text-sm" htmlFor="default-payment-term">
          Hạn công nợ mặc định (ngày)
          <input
            id="default-payment-term"
            type="number"
            min="0"
            step="1"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className={inputClass}
            disabled={loading || saving}
          />
        </label>
        <p className="mt-2 text-xs text-black/55 dark:text-white/55">
          Số ngày mỗi khách hàng mới được nợ, tính từ ngày tạo đơn. Giá trị ban đầu là 3 ngày.
          Có thể đổi riêng trên từng khách hàng.
        </p>
        <button
          type="submit"
          disabled={loading || saving}
          className="mt-4 h-10 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
      </form>
    </main>
  );
}
