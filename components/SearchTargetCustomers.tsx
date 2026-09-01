"use client";

import { useAuth } from "@clerk/nextjs";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  confirmTargetCustomers,
  fetchTargetCustomerLists,
  removeFoundTargetCustomer,
  searchTargetCustomers,
  type TargetCustomer,
  type TargetCustomerList,
} from "@/lib/api";

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

function ConfirmSaveDialog({
  open,
  listName,
  count,
  saving,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  listName: string;
  count: number;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-black/40"
        onClick={saving ? undefined : onCancel}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-black/10 bg-background p-5 shadow-lg dark:border-white/15">
        <h2 className="text-lg font-semibold">Xác nhận lưu danh sách</h2>
        <p className="mt-2 text-sm text-black/70 dark:text-white/70">
          Lưu <span className="font-medium">{count}</span> khách hàng mục tiêu
          vào danh sách{" "}
          <span className="font-medium">{listName || "đã chọn"}</span>? Những
          khách hàng đã xóa sẽ không được lưu.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-black/15 px-4 py-2 text-sm disabled:opacity-50 dark:border-white/20"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {saving ? "Đang lưu..." : "Đồng ý lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerCard({
  customer,
  reviewing,
  removing,
  onRemove,
}: {
  customer: TargetCustomer;
  reviewing: boolean;
  removing: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="rounded-xl border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold">{customer.name}</h3>
        {reviewing && customer.id ? (
          <button
            type="button"
            onClick={() => onRemove(customer.id as string)}
            disabled={removing}
            className="shrink-0 rounded-md border border-red-200 px-2.5 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            {removing ? "Đang xóa..." : "Xóa"}
          </button>
        ) : null}
      </div>
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
            <dt className="inline text-black/50 dark:text-white/50">Địa chỉ: </dt>
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
            <dt className="text-black/50 dark:text-white/50">Lý do chọn</dt>
            <dd className="mt-0.5">{customer.reason_to_choose}</dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}

export function SearchTargetCustomers() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const listId = searchParams.get("listId")?.trim() ?? "";
  const [query, setQuery] = useState("");
  const [selectedList, setSelectedList] = useState<TargetCustomerList | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TargetCustomer[] | null>(null);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reviewing = Boolean(searchId) && !saved;
  const listName = selectedList?.name ?? "";

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedList() {
      if (!listId) {
        setSelectedList(null);
        return;
      }
      try {
        const token = await getToken();
        if (!token) return;
        const lists = await fetchTargetCustomerLists(token);
        if (cancelled) return;
        setSelectedList(lists.find((list) => list.id === listId) ?? null);
      } catch {
        if (!cancelled) setSelectedList(null);
      }
    }

    void loadSelectedList();
    return () => {
      cancelled = true;
    };
  }, [getToken, listId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || !listId || loading) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setSearchId(null);
    setSaved(false);
    setConfirmOpen(false);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
      }
      const payload = await searchTargetCustomers(trimmed, token, listId);
      setSelectedList(payload.list);
      setResults(payload.customers);
      setSearchId(payload.search_id);
      setSaved(payload.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tìm kiếm.");
    } finally {
      setLoading(false);
    }
  }

  async function onRemoveCustomer(customerId: string) {
    if (!searchId || saved || removingId || saving) return;

    setRemovingId(customerId);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
      }
      const payload = await removeFoundTargetCustomer(
        token,
        searchId,
        customerId,
      );
      setResults(payload.customers);
      setSelectedList(payload.list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa khách hàng.");
    } finally {
      setRemovingId(null);
    }
  }

  async function onConfirmSave() {
    if (!searchId || saved || saving || removingId) return;

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
      }
      const payload = await confirmTargetCustomers(token, searchId);
      setResults(payload.customers);
      setSelectedList(payload.list);
      setSaved(true);
      setSearchId(null);
      setConfirmOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể lưu khách hàng mục tiêu.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10 pb-28">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tìm khách hàng mục tiêu
          </h1>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            Tìm trên internet, xóa những khách hàng không phù hợp, rồi xác nhận
            lưu vào danh sách.
          </p>
          {listId && listName ? (
            <p className="mt-3 inline-flex rounded-full border border-black/10 px-3 py-1 text-xs dark:border-white/15">
              Đang lưu vào: {listName}
            </p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {!listId ? (
            <p className="rounded-lg border border-black/10 px-3 py-2 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
              Hãy chọn hoặc tạo một danh sách ở thanh bên trước khi tìm kiếm.
            </p>
          ) : null}
          <label htmlFor="search-query" className="text-sm font-medium">
            Mô tả tìm kiếm
          </label>
          <textarea
            id="search-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={4}
            placeholder="Ví dụ: Tìm khách hàng mục tiêu cho sản phẩm cửa cuốn nhôm tại quận Gò Vấp, TP. Hồ Chí Minh"
            className="w-full resize-y rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            disabled={loading || !listId}
          />
          <button
            type="submit"
            disabled={loading || !query.trim() || !listId}
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

        {saved && results ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Đã lưu {results.length} khách hàng vào {listName || "danh sách"}.
          </p>
        ) : null}

        {results && results.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            {saved
              ? "Không có khách hàng nào được lưu."
              : reviewing
                ? "Đã xóa hết kết quả. Không còn khách hàng nào để lưu."
                : "Không tìm thấy khách hàng mục tiêu mới."}
          </p>
        ) : null}

        {results && results.length > 0 ? (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {reviewing ? "Xem lại kết quả" : "Khách hàng đã lưu"}
                </h2>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                  {reviewing
                    ? `${results.length} khách hàng. Xóa những kết quả không phù hợp trước khi lưu.`
                    : `${results.length} khách hàng trong ${listName || "danh sách"}.`}
                </p>
              </div>
              {reviewing ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                  Chưa lưu
                </span>
              ) : null}
            </div>
            <ul className="flex flex-col gap-4">
              {results.map((customer) => (
                <CustomerCard
                  key={customer.id ?? `${customer.name}-${customer.website}`}
                  customer={customer}
                  reviewing={reviewing}
                  removing={removingId === customer.id}
                  onRemove={onRemoveCustomer}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {reviewing && results && results.length > 0 ? (
        <div className="sticky bottom-0 z-20 border-t border-black/10 bg-background/95 px-6 py-3 backdrop-blur dark:border-white/10">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
            <p className="text-sm text-black/70 dark:text-white/70">
              Còn <span className="font-medium">{results.length}</span> khách
              hàng sẽ được lưu
              {listName ? ` vào ${listName}` : ""}.
            </p>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={saving || Boolean(removingId)}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
            >
              Xác nhận lưu
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmSaveDialog
        open={confirmOpen}
        listName={listName}
        count={results?.length ?? 0}
        saving={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={onConfirmSave}
      />
    </main>
  );
}
