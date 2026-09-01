"use client";

import { useAuth } from "@clerk/nextjs";
import { FormEvent, useState } from "react";
import { searchTargetCustomers, type TargetCustomer } from "@/lib/api";

function hasText(value?: string) {
  return Boolean(value?.trim());
}

function toHref(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes("facebook.com") || trimmed.includes("fb.com")) {
    return `https://${trimmed.replace(/^\/\//, "")}`;
  }
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  return trimmed;
}

export function SearchTargetCustomers() {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TargetCustomer[] | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
      }
      const customers = await searchTargetCustomers(trimmed, token);
      setResults(customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tìm kiếm.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tìm khách hàng mục tiêu
        </h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Mô tả sản phẩm và khu vực. Hệ thống sẽ tìm trên internet và lưu khách
          hàng mới vào danh sách của bạn.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="search-query" className="text-sm font-medium">
          Mô tả tìm kiếm
        </label>
        <textarea
          id="search-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={4}
          placeholder="Ví dụ: Tìm khách hàng mục tiêu cho sản phẩm cửa nhôm tại quận Gò Vấp, TP. Hồ Chí Minh"
          className="w-full resize-y rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="self-start rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Đang tìm kiếm..." : "Tìm kiếm"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Đang tìm trên internet, có thể mất một vài phút...
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {results && results.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          Không có khách hàng mới được lưu. Có thể các kết quả đã tồn tại trong
          danh sách.
        </p>
      ) : null}

      {results && results.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {results.map((customer) => (
            <li
              key={customer.id ?? `${customer.name}-${customer.website}`}
              className="rounded-xl border border-black/10 p-4 dark:border-white/15"
            >
              <h2 className="text-base font-semibold">{customer.name}</h2>
              <div className="mt-2 flex flex-col gap-1 text-sm">
                {hasText(customer.website) ? (
                  <a
                    href={toHref(customer.website)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {customer.website.trim()}
                  </a>
                ) : null}
                {hasText(customer.facebook) ? (
                  <a
                    href={toHref(customer.facebook)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {customer.facebook.trim()}
                  </a>
                ) : null}
              </div>
              {hasText(customer.summary_about_the_target_customer) ? (
                <p className="mt-2 text-sm text-black/70 dark:text-white/70">
                  {customer.summary_about_the_target_customer}
                </p>
              ) : null}
              <dl className="mt-3 grid gap-1 text-sm">
                {hasText(customer.address) ? (
                  <div>
                    <dt className="inline text-black/50 dark:text-white/50">
                      Địa chỉ:{" "}
                    </dt>
                    <dd className="inline">{customer.address}</dd>
                  </div>
                ) : null}
                {hasText(customer.phone_number) ? (
                  <div>
                    <dt className="inline text-black/50 dark:text-white/50">
                      Điện thoại:{" "}
                    </dt>
                    <dd className="inline">{customer.phone_number}</dd>
                  </div>
                ) : null}
                {hasText(customer.reason_to_choose) ? (
                  <div className="mt-2">
                    <dt className="text-black/50 dark:text-white/50">
                      Lý do chọn
                    </dt>
                    <dd className="mt-0.5">{customer.reason_to_choose}</dd>
                  </div>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
