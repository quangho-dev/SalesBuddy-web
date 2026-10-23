"use client";

import { customerLabel } from "@/components/CustomerPicker";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  listCustomers,
  listOrders,
  updateOrder,
  type Customer,
  type Order,
} from "@/lib/api";

const ALL_CUSTOMERS = "";
const VAT_RATE = 0.1;
const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-60 dark:border-white/20 dark:focus:border-white/50";

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPrice(value: unknown): string {
  return toNumber(value).toLocaleString("vi-VN");
}

function formatDate(value?: string): string {
  const iso = (value ?? "").slice(0, 10);
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return value ?? "";
  return `${day}/${month}/${year}`;
}

function orderCustomer(order: Order, customers: Customer[]) {
  return (
    order.customers ??
    customers.find((customer) => customer.id === order.customer_id) ??
    null
  );
}

function lineTotal(item: { quantity?: unknown; selling_price?: unknown }) {
  return toNumber(item.quantity) * toNumber(item.selling_price);
}

function lineVat(item: {
  quantity?: unknown;
  selling_price?: unknown;
  vat_invoice?: boolean;
}) {
  if (!item.vat_invoice) return 0;
  return Math.round(lineTotal(item) * VAT_RATE);
}

function orderTotal(order: Order): number {
  const items = order.items ?? [];
  return items.reduce((sum, item) => sum + lineTotal(item) + lineVat(item), 0);
}

export function DebtsPanel() {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState(ALL_CUSTOMERS);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);

  const selected = orders.find((order) => order.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    let rows = orders.filter((order) => !order.is_paid);
    if (customerFilter) {
      rows = rows.filter((order) => order.customer_id === customerFilter);
    }
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((order) => {
      const customer = orderCustomer(order, customers);
      const haystack = [
        customerLabel(customer),
        customer?.phone_number ?? "",
        order.notes,
        formatDate(order.order_date),
        order.order_date,
        ...(order.items ?? []).map((item) => item.product_name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [customers, customerFilter, orders, query]);

  const outstandingTotal = useMemo(
    () => filtered.reduce((sum, order) => sum + orderTotal(order), 0),
    [filtered],
  );

  const withToken = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
    }
    return token;
  }, [getToken]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const token = await withToken();
      const [orderRows, customerRows] = await Promise.all([
        listOrders(token, { isPaid: false }),
        listCustomers(token),
      ]);
      setOrders(orderRows.filter((order) => !order.is_paid));
      setCustomers(customerRows);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không tải được danh sách công nợ.",
      );
    } finally {
      setLoadingList(false);
    }
  }, [withToken]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!customerFilter) return;
    if (customers.some((customer) => customer.id === customerFilter)) return;
    setCustomerFilter(ALL_CUSTOMERS);
  }, [customerFilter, customers]);

  useEffect(() => {
    if (selectedId && filtered.some((order) => order.id === selectedId)) return;
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered, selectedId]);

  async function markPaid() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const token = await withToken();
      await updateOrder(token, selectedId, { is_paid: true });
      setOrders((current) => current.filter((order) => order.id !== selectedId));
      toast.success("Đã đánh dấu đơn hàng là đã thanh toán.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không cập nhật được thanh toán.",
      );
    } finally {
      setSaving(false);
    }
  }

  const showDetail = selectedId !== null;
  const selectedCustomer = selected ? orderCustomer(selected, customers) : null;
  const selectedItems = selected?.items ?? [];
  const selectedTotals = selected
    ? selectedItems.reduce(
        (acc, item) => {
          const subtotal = lineTotal(item);
          const vat = lineVat(item);
          return {
            subtotal: acc.subtotal + subtotal,
            vat: acc.vat + vat,
            grand: acc.grand + subtotal + vat,
          };
        },
        { subtotal: 0, vat: 0, grand: 0 },
      )
    : { subtotal: 0, vat: 0, grand: 0 };

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-black/10 px-6 py-4 dark:border-white/10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Công nợ</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Các đơn hàng chưa thanh toán. Tổng công nợ:{" "}
            <span className="font-semibold text-black dark:text-white">
              {formatPrice(outstandingTotal)}đ
            </span>
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={`flex w-full min-h-0 flex-col border-r border-black/10 md:w-80 dark:border-white/10 ${
            showDetail ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="flex flex-col gap-3 border-b border-black/10 p-4 dark:border-white/10">
            <label className="flex flex-col gap-1 text-sm">
              Khách hàng
              <select
                value={customerFilter}
                onChange={(event) => setCustomerFilter(event.target.value)}
                className={inputClass}
              >
                <option value={ALL_CUSTOMERS}>Tất cả</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customerLabel(customer)}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="debt-search" className="sr-only">
              Tìm công nợ
            </label>
            <input
              id="debt-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm khách, sản phẩm, ghi chú..."
              className={inputClass}
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {loadingList ? (
              <li className="px-3 py-6 text-center text-sm text-black/50 dark:text-white/50">
                Đang tải...
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-black/50 dark:text-white/50">
                {orders.length === 0
                  ? "Không có đơn hàng chưa thanh toán."
                  : customerFilter
                    ? "Khách hàng này không còn công nợ."
                    : "Không tìm thấy công nợ phù hợp."}
              </li>
            ) : (
              filtered.map((order) => {
                const active = order.id === selectedId;
                const customer = orderCustomer(order, customers);
                const items = order.items ?? [];
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(order.id)}
                      className={`w-full rounded-lg px-3 py-3 text-left ${
                        active
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                    >
                      <p className="truncate text-sm font-bold">{customerLabel(customer)}</p>
                      <p className="mt-0.5 truncate text-xs">
                        <span className={active ? "opacity-80" : "text-black/55 dark:text-white/55"}>
                          {formatDate(order.order_date)}
                          {" · "}
                          {items.length} SP
                          {" · "}
                        </span>
                        <span className="font-bold">{formatPrice(orderTotal(order))}đ</span>
                      </p>
                      {items[0]?.product_name ? (
                        <p
                          className={`mt-0.5 truncate text-xs ${
                            active ? "opacity-80" : "text-black/55 dark:text-white/55"
                          }`}
                        >
                          {items.map((item) => item.product_name).filter(Boolean).join(", ")}
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section
          className={`min-h-0 min-w-0 flex-1 overflow-y-auto ${
            showDetail ? "block" : "hidden md:block"
          }`}
        >
          {!selected ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-black/55 dark:text-white/55">
              Chọn một đơn hàng chưa thanh toán.
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-md border border-black/15 px-2 py-1 text-sm md:hidden dark:border-white/20"
                  >
                    Danh sách
                  </button>
                  <h2 className="text-base font-semibold tracking-tight">
                    {customerLabel(selectedCustomer)} · {formatDate(selected.order_date)}
                  </h2>
                </div>
                <Link
                  href={`/orders?id=${encodeURIComponent(selected.id)}`}
                  className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
                >
                  Mở đơn hàng
                </Link>
              </div>

              <div className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15">
                <p className="font-medium">{customerLabel(selectedCustomer)}</p>
                {selectedCustomer?.phone_number?.trim() ? (
                  <p className="mt-0.5 text-xs text-black/60 dark:text-white/60">
                    {selectedCustomer.phone_number}
                  </p>
                ) : null}
              </div>

              {selected.notes.trim() ? (
                <p className="rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15">
                  {selected.notes}
                </p>
              ) : null}

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Sản phẩm</h3>
                {selectedItems.length === 0 ? (
                  <p className="text-sm text-black/55 dark:text-white/55">Không có sản phẩm.</p>
                ) : (
                  selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-black/10 px-3 py-3 text-sm dark:border-white/15"
                    >
                      <p className="font-medium">{item.product_name}</p>
                      <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                        {[
                          item.unit.trim() || null,
                          `SL ${formatPrice(item.quantity)}`,
                          `${formatPrice(item.selling_price)}đ`,
                          item.vat_invoice ? "VAT 10%" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-1 font-bold">
                        {formatPrice(lineTotal(item) + lineVat(item))}đ
                      </p>
                    </div>
                  ))
                )}
                <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
                  <p className="flex justify-between gap-4">
                    <span className="text-black/60 dark:text-white/60">Tạm tính</span>
                    <span>{formatPrice(selectedTotals.subtotal)}đ</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span className="text-black/60 dark:text-white/60">Thuế VAT (10%)</span>
                    <span>{formatPrice(selectedTotals.vat)}đ</span>
                  </p>
                  <p className="flex justify-between gap-4 font-bold">
                    <span>Công nợ</span>
                    <span>{formatPrice(selectedTotals.grand)}đ</span>
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void markPaid()}
                  disabled={saving}
                  className="h-10 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {saving ? "Đang cập nhật..." : "Đánh dấu đã thanh toán"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
