"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import {
  getDashboard,
  type Dashboard,
  type DashboardCustomerRank,
  type DashboardPeriod,
  type DashboardProductRank,
  type DashboardRevenuePoint,
} from "@/lib/api";

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: "day", label: "Hôm nay" },
  { value: "week", label: "Tuần này" },
  { value: "month", label: "Tháng này" },
  { value: "year", label: "Năm nay" },
];

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function formatPrice(value: number): string {
  return Math.round(value).toLocaleString("vi-VN");
}

function formatQuantity(value: number): string {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function datePart(iso: string): string {
  return iso.slice(0, 10);
}

function shiftDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

function rangeLabel(data: Dashboard): string {
  const start = datePart(data.from);
  const end = shiftDate(datePart(data.to), -1);
  if (data.period === "day") return formatDay(start);
  if (data.period === "year") return start.slice(0, 4);
  if (data.period === "month") {
    return `Tháng ${Number(start.slice(5, 7))}/${start.slice(0, 4)}`;
  }
  return `${formatDay(start)} – ${formatDay(end)}`;
}

function pointLabel(point: DashboardRevenuePoint, data: Dashboard): string {
  if (data.revenue_series.bucket === "hour") {
    return `${Number(point.key.slice(11, 13))}h`;
  }
  if (data.revenue_series.bucket === "month") {
    return `T${Number(point.key.slice(5, 7))}`;
  }
  const [year, month, day] = point.key.split("-").map(Number);
  if (data.period === "week") {
    return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
  }
  return String(day);
}

function pointDetail(point: DashboardRevenuePoint, data: Dashboard): string {
  if (data.revenue_series.bucket === "hour") {
    const hour = point.key.slice(11, 13);
    return `${formatDay(point.key.slice(0, 10))} ${hour}:00`;
  }
  if (data.revenue_series.bucket === "month") {
    return `Tháng ${Number(point.key.slice(5, 7))}/${point.key.slice(0, 4)}`;
  }
  return formatDay(point.key);
}

function customerName(row: DashboardCustomerRank): string {
  return (
    row.company_name.trim() ||
    row.contact_person.trim() ||
    row.customer_code.trim() ||
    "Khách hàng chưa đặt tên"
  );
}

function productName(row: DashboardProductRank): string {
  const name = row.product_name.trim() || "Sản phẩm";
  const code = row.product_code.trim();
  return code ? `${code} · ${name}` : name;
}

function RevenueChart({
  data,
  activeKey,
  onSelect,
}: {
  data: Dashboard;
  activeKey: string | null;
  onSelect: (key: string) => void;
}) {
  const points = data.revenue_series.points;
  const max = Math.max(...points.map((point) => point.revenue), 0);
  const active = points.find((point) => point.key === activeKey) ?? null;

  return (
    <section className="rounded-xl border border-black/10 p-4 dark:border-white/15">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Doanh thu theo thời gian</h2>
        <p className="text-xs text-black/55 dark:text-white/55">{rangeLabel(data)}</p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div
          className="flex h-52 items-end gap-1"
          style={{ minWidth: Math.max(points.length * 28, 280) }}
          role="list"
          aria-label="Doanh thu theo thời gian"
        >
          {points.map((point) => {
            const height = max > 0 ? (point.revenue / max) * 100 : 0;
            const selected = point.key === activeKey;
            const label = pointLabel(point, data);
            return (
              <div key={point.key} className="flex min-w-0 flex-1 flex-col items-center" role="listitem">
                <button
                  type="button"
                  onClick={() => onSelect(point.key)}
                  aria-pressed={selected}
                  aria-label={`${pointDetail(point, data)}: ${formatPrice(point.revenue)} đồng, ${point.order_count} đơn`}
                  className="flex h-44 w-full items-end"
                >
                  <span
                    className={`block w-full rounded-t ${
                      selected
                        ? "bg-black dark:bg-white"
                        : "bg-black/70 hover:bg-black dark:bg-white/70 dark:hover:bg-white"
                    }`}
                    style={{ height: `${height}%`, minHeight: point.revenue > 0 ? 3 : 0 }}
                  />
                </button>
                <span className="mt-1 text-[10px] text-black/50 dark:text-white/50">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-sm text-black/70 dark:text-white/70">
        {active
          ? `${pointDetail(active, data)} · ${formatPrice(active.revenue)}đ · ${active.order_count} đơn`
          : `${formatPrice(data.revenue[data.period])}đ · ${data.order_count[data.period]} đơn`}
      </p>
    </section>
  );
}

function RankList({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-black/10 p-4 dark:border-white/15">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children ? (
        <ol className="mt-3 flex flex-col gap-2">{children}</ol>
      ) : (
        <p className="mt-4 text-sm text-black/50 dark:text-white/50">{empty}</p>
      )}
    </section>
  );
}

export function DashboardPanel() {
  const { getToken } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setActiveKey(null);
    void (async () => {
      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
        }
        const payload = await getDashboard(token, period, 5);
        if (!cancelled) setData(payload);
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Không tải được tổng quan.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, period]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-black/10 px-6 py-4 dark:border-white/10">
        <h1 className="text-lg font-semibold tracking-tight">Tổng quan</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Doanh thu, đơn hàng và khách mới theo hôm nay, tuần, tháng và năm.
          Biểu đồ và bảng xếp hạng theo khoảng đang chọn.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {loading && !data ? (
          <p className="py-16 text-center text-sm text-black/50 dark:text-white/50">
            Đang tải...
          </p>
        ) : !data ? (
          <p className="py-16 text-center text-sm text-black/50 dark:text-white/50">
            Không tải được tổng quan.
          </p>
        ) : (
          <div className={`flex flex-col gap-4 ${loading ? "opacity-60" : ""}`}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {PERIODS.map((item) => {
                const selected = item.value === period;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPeriod(item.value)}
                    aria-pressed={selected}
                    className={`rounded-xl border px-4 py-3 text-left ${
                      selected
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-black/10 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                    }`}
                  >
                    <p className={`text-xs ${selected ? "opacity-80" : "text-black/55 dark:text-white/55"}`}>
                      {item.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold tracking-tight">
                      {formatPrice(data.revenue[item.value])}đ
                    </p>
                    <p className={`mt-1 text-xs ${selected ? "opacity-80" : "text-black/55 dark:text-white/55"}`}>
                      {data.order_count[item.value]} đơn ·{" "}
                      {data.new_customer_count[item.value]} khách mới
                    </p>
                  </button>
                );
              })}
              <Link
                href="/debts"
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-200/40 dark:bg-amber-300/15 dark:text-amber-100"
              >
                <p className="text-xs font-medium">Công nợ phải thu</p>
                <p className="mt-2 text-lg font-semibold tracking-tight">
                  {formatPrice(data.receivable)}đ
                </p>
                <p className="mt-1 text-xs">
                  {data.receivable_order_count} đơn chưa thanh toán
                </p>
              </Link>
            </div>

            {data.period === period ? (
              <RevenueChart
                data={data}
                activeKey={activeKey}
                onSelect={(key) =>
                  setActiveKey((current) => (current === key ? null : key))
                }
              />
            ) : (
              <p className="py-10 text-center text-sm text-black/50 dark:text-white/50">
                Đang tải biểu đồ...
              </p>
            )}

            {data.period === period ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <RankList
                title="Top 5 khách hàng"
                empty="Chưa có doanh thu trong khoảng này."
              >
                {data.top_customers.length
                  ? data.top_customers.map((row, index) => (
                      <li
                        key={row.customer_id}
                        className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <span className="mt-0.5 w-5 text-sm font-semibold text-black/45 dark:text-white/45">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{customerName(row)}</p>
                          <p className="text-xs text-black/55 dark:text-white/55">
                            {row.customer_code.trim() &&
                            row.customer_code.trim() !== customerName(row)
                              ? `${row.customer_code.trim()} · `
                              : ""}
                            {row.order_count} đơn
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {formatPrice(row.revenue)}đ
                        </p>
                      </li>
                    ))
                  : null}
              </RankList>

              <RankList
                title="Top 5 sản phẩm bán chạy"
                empty="Chưa có sản phẩm bán trong khoảng này."
              >
                {data.top_products.length
                  ? data.top_products.map((row, index) => (
                      <li
                        key={`${row.product_id ?? "custom"}-${row.product_name}-${row.unit}`}
                        className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <span className="mt-0.5 w-5 text-sm font-semibold text-black/45 dark:text-white/45">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{productName(row)}</p>
                          <p className="text-xs text-black/55 dark:text-white/55">
                            {formatQuantity(row.quantity)}
                            {row.unit.trim() ? ` ${row.unit}` : ""} · {row.order_count} đơn
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {formatPrice(row.revenue)}đ
                        </p>
                      </li>
                    ))
                  : null}
              </RankList>
            </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
