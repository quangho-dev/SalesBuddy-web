"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  cancelDelivery,
  getDeliverySettings,
  listDeliveries,
  placeDelivery,
  quoteDelivery,
  refreshDelivery,
  updateDeliverySettings,
  type Delivery,
  type DeliverySettings,
  type DeliveryStatus,
} from "@/lib/api";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-60 dark:border-white/20 dark:focus:border-white/50";

const SERVICE_TYPES = ["MOTORCYCLE", "CAR", "VAN", "TRUCK"];

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  draft: "Bản nháp",
  quoted: "Đã báo giá",
  assigning_driver: "Đang tìm tài xế",
  ongoing: "Tài xế đang đến",
  picked_up: "Đã lấy hàng",
  completed: "Đã giao",
  canceled: "Đã hủy",
  rejected: "Bị từ chối",
  expired: "Hết hạn",
  failed: "Lỗi",
};

const EMPTY_SETTINGS: DeliverySettings = {
  pickup_name: "",
  pickup_phone: "",
  pickup_address: "",
  pickup_lat: "",
  pickup_lng: "",
  market: "VN",
  default_service_type: "MOTORCYCLE",
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatFee(value: unknown, currency: string) {
  const amount = toNumber(value);
  if (amount === null) return "";
  return `${amount.toLocaleString("vi-VN")} ${currency || "VND"}`;
}

function formatWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function settingsReady(settings: DeliverySettings) {
  return Boolean(
    settings.pickup_name.trim() &&
      settings.pickup_phone.trim() &&
      settings.pickup_address.trim() &&
      toNumber(settings.pickup_lat) !== null &&
      toNumber(settings.pickup_lng) !== null,
  );
}

export function OrderDeliveryCard({
  orderId,
  customerName,
  customerPhone,
  customerAddress,
  onDelivered,
}: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  onDelivered: () => Promise<void> | void;
}) {
  const { getToken } = useAuth();
  const [settings, setSettings] = useState<DeliverySettings>(EMPTY_SETTINGS);
  const [editingPickup, setEditingPickup] = useState(false);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [serviceType, setServiceType] = useState("MOTORCYCLE");
  const [dropoffLat, setDropoffLat] = useState("");
  const [dropoffLng, setDropoffLng] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirmPlace, setConfirmPlace] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const withToken = useCallback(async () => {
    const token = await getToken();
    if (!token) throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
    return token;
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setConfirmPlace(false);
      setConfirmCancel(false);
      try {
        const token = await withToken();
        const [savedSettings, rows] = await Promise.all([
          getDeliverySettings(token),
          listDeliveries(token, orderId),
        ]);
        if (cancelled) return;
        setSettings({ ...EMPTY_SETTINGS, ...savedSettings });
        setServiceType(savedSettings.default_service_type || "MOTORCYCLE");
        setEditingPickup(!settingsReady(savedSettings));
        const latest = rows[0] ?? null;
        setDelivery(latest);
        const dropoff = latest?.stops.find((stop) => stop.role === "dropoff");
        setDropoffLat(dropoff?.lat == null ? "" : String(dropoff.lat));
        setDropoffLng(dropoff?.lng == null ? "" : String(dropoff.lng));
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Không tải được giao hàng.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId, withToken]);

  async function savePickup() {
    const lat = toNumber(settings.pickup_lat);
    const lng = toNumber(settings.pickup_lng);
    if (!settings.pickup_name.trim() || !settings.pickup_phone.trim() || !settings.pickup_address.trim()) {
      toast.error("Hãy nhập tên, điện thoại và địa chỉ điểm lấy.");
      return;
    }
    if (lat === null || lng === null) {
      toast.error("Hãy nhập vĩ độ và kinh độ điểm lấy.");
      return;
    }
    setWorking(true);
    try {
      const token = await withToken();
      const saved = await updateDeliverySettings(token, {
        ...settings,
        pickup_lat: lat,
        pickup_lng: lng,
        default_service_type: serviceType,
      });
      setSettings(saved);
      setEditingPickup(false);
      toast.success("Đã lưu điểm lấy hàng.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được điểm lấy hàng.");
    } finally {
      setWorking(false);
    }
  }

  async function applyDelivery(next: Delivery) {
    setDelivery(next);
    if (next.status === "completed") {
      await onDelivered();
    }
  }

  async function onQuote() {
    const lat = toNumber(dropoffLat);
    const lng = toNumber(dropoffLng);
    if (!customerAddress.trim()) {
      toast.error("Khách hàng chưa có địa chỉ giao.");
      return;
    }
    if (!customerPhone.trim()) {
      toast.error("Khách hàng chưa có số điện thoại.");
      return;
    }
    if (lat === null || lng === null) {
      toast.error("Hãy nhập vĩ độ và kinh độ điểm giao.");
      return;
    }
    setWorking(true);
    try {
      const token = await withToken();
      const quoted = await quoteDelivery(token, {
        order_id: orderId,
        service_type: serviceType,
        dropoff_lat: lat,
        dropoff_lng: lng,
      });
      await applyDelivery(quoted);
      toast.success("Đã có báo giá giao hàng.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không báo giá được.");
    } finally {
      setWorking(false);
    }
  }

  async function onPlace() {
    if (!delivery) return;
    setWorking(true);
    try {
      const token = await withToken();
      const placed = await placeDelivery(token, delivery.id);
      setConfirmPlace(false);
      await applyDelivery(placed);
      toast.success("Đã đặt chuyến Lalamove.");
    } catch (err) {
      setConfirmPlace(false);
      toast.error(err instanceof Error ? err.message : "Không đặt được chuyến.");
    } finally {
      setWorking(false);
    }
  }

  async function onCancel() {
    if (!delivery) return;
    setWorking(true);
    try {
      const token = await withToken();
      const canceled = await cancelDelivery(token, delivery.id, "Hủy từ đơn hàng");
      setConfirmCancel(false);
      setDelivery(canceled);
      toast.success("Đã hủy chuyến giao.");
    } catch (err) {
      setConfirmCancel(false);
      toast.error(err instanceof Error ? err.message : "Không hủy được chuyến.");
    } finally {
      setWorking(false);
    }
  }

  async function onRefresh() {
    if (!delivery) return;
    setWorking(true);
    try {
      const token = await withToken();
      const fresh = await refreshDelivery(token, delivery.id);
      await applyDelivery(fresh);
      toast.success("Đã cập nhật trạng thái giao hàng.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không cập nhật được trạng thái.");
    } finally {
      setWorking(false);
    }
  }

  const openTrip =
    delivery &&
    ["quoted", "assigning_driver", "ongoing", "picked_up"].includes(delivery.status);
  const canQuote = !delivery || ["canceled", "rejected", "expired", "failed", "completed", "quoted", "draft"].includes(delivery.status);
  const canPlace = delivery?.status === "quoted";
  const canCancel = Boolean(
    delivery && ["quoted", "assigning_driver", "ongoing"].includes(delivery.status),
  );
  const canRefresh = Boolean(delivery?.provider_order_id);

  return (
    <section className="rounded-xl border border-black/15 p-4 dark:border-white/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Giao hàng</h3>
        {delivery ? (
          <span className="text-xs font-medium text-black/70 dark:text-white/70">
            {STATUS_LABEL[delivery.status] ?? delivery.status}
          </span>
        ) : null}
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-black/55 dark:text-white/55">Đang tải giao hàng...</p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {editingPickup || !settingsReady(settings) ? (
            <div
              className="grid gap-3 sm:grid-cols-2"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void savePickup();
                }
              }}
            >
              <p className="text-sm font-medium sm:col-span-2">Điểm lấy hàng</p>
              <label className="flex flex-col gap-1 text-sm">
                Tên
                <input
                  value={settings.pickup_name}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, pickup_name: event.target.value }))
                  }
                  className={inputClass}
                  disabled={working}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Điện thoại
                <input
                  value={settings.pickup_phone}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, pickup_phone: event.target.value }))
                  }
                  className={inputClass}
                  disabled={working}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Địa chỉ
                <input
                  value={settings.pickup_address}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, pickup_address: event.target.value }))
                  }
                  className={inputClass}
                  disabled={working}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Vĩ độ
                <input
                  value={settings.pickup_lat ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, pickup_lat: event.target.value }))
                  }
                  className={inputClass}
                  disabled={working}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Kinh độ
                <input
                  value={settings.pickup_lng ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, pickup_lng: event.target.value }))
                  }
                  className={inputClass}
                  disabled={working}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Thị trường
                <input
                  value={settings.market}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, market: event.target.value }))
                  }
                  className={inputClass}
                  disabled={working}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void savePickup()}
                  disabled={working}
                  className="h-10 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  Lưu điểm lấy
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">Điểm lấy: {settings.pickup_name}</p>
                <p className="mt-0.5 text-black/60 dark:text-white/60">
                  {settings.pickup_phone} · {settings.pickup_address}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPickup(true)}
                className="shrink-0 text-sm underline"
                disabled={working}
              >
                Sửa
              </button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-sm sm:col-span-2">
              <p className="font-medium">Điểm giao: {customerName || "Khách hàng"}</p>
              <p className="mt-0.5 text-black/60 dark:text-white/60">
                {customerPhone || "Chưa có điện thoại"} · {customerAddress || "Chưa có địa chỉ"}
              </p>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Vĩ độ điểm giao
              <input
                value={dropoffLat}
                onChange={(event) => setDropoffLat(event.target.value)}
                className={inputClass}
                disabled={working || Boolean(openTrip && delivery?.status !== "quoted")}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Kinh độ điểm giao
              <input
                value={dropoffLng}
                onChange={(event) => setDropoffLng(event.target.value)}
                className={inputClass}
                disabled={working || Boolean(openTrip && delivery?.status !== "quoted")}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Loại xe
              <select
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value)}
                className={inputClass}
                disabled={working || Boolean(openTrip && delivery?.status !== "quoted")}
              >
                {(SERVICE_TYPES.includes(serviceType)
                  ? SERVICE_TYPES
                  : [serviceType, ...SERVICE_TYPES]
                ).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {delivery ? (
            <div className="text-sm">
              {delivery.quoted_fee ? (
                <p>
                  Phí: {formatFee(delivery.quoted_fee, delivery.currency)}
                  {delivery.quotation_expires_at && delivery.status === "quoted"
                    ? ` · hết hạn ${formatWhen(delivery.quotation_expires_at)}`
                    : ""}
                </p>
              ) : null}
              {delivery.driver_name || delivery.driver_phone || delivery.driver_plate ? (
                <p className="mt-1 text-black/70 dark:text-white/70">
                  Tài xế: {[delivery.driver_name, delivery.driver_phone, delivery.driver_plate].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {delivery.share_link ? (
                <a
                  href={delivery.share_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex underline"
                >
                  Theo dõi chuyến
                </a>
              ) : null}
              {delivery.failure_reason ? (
                <p className="mt-1 text-red-700 dark:text-red-300">{delivery.failure_reason}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-black/55 dark:text-white/55">
              Đơn này chưa có chuyến giao.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {canQuote ? (
              <button
                type="button"
                onClick={() => void onQuote()}
                disabled={working || !settingsReady(settings)}
                className="h-10 rounded-lg border border-black/15 px-4 text-sm disabled:opacity-50 dark:border-white/20"
              >
                Báo giá
              </button>
            ) : null}
            {canPlace ? (
              <button
                type="button"
                onClick={() => setConfirmPlace(true)}
                disabled={working}
                className="h-10 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                Đặt giao hàng
              </button>
            ) : null}
            {canRefresh ? (
              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={working}
                className="h-10 rounded-lg border border-black/15 px-4 text-sm disabled:opacity-50 dark:border-white/20"
              >
                Cập nhật trạng thái
              </button>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                disabled={working}
                className="h-10 rounded-lg border border-red-300 px-4 text-sm text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300"
              >
                Hủy chuyến
              </button>
            ) : null}
          </div>
        </div>
      )}

      {confirmPlace ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-black"
          >
            <h3 className="text-base font-semibold">Đặt giao hàng</h3>
            <p className="mt-2 text-sm text-black/70 dark:text-white/70">
              Đặt chuyến Lalamove với phí {delivery ? formatFee(delivery.quoted_fee, delivery.currency) : ""}.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPlace(false)}
                disabled={working}
                className="h-10 rounded-lg border border-black/15 px-4 text-sm dark:border-white/20"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void onPlace()}
                disabled={working}
                className="h-10 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {working ? "Đang đặt..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmCancel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-black"
          >
            <h3 className="text-base font-semibold">Hủy chuyến giao</h3>
            <p className="mt-2 text-sm text-black/70 dark:text-white/70">
              Hủy chuyến này trên Lalamove. Đơn hàng vẫn được giữ.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                disabled={working}
                className="h-10 rounded-lg border border-black/15 px-4 text-sm dark:border-white/20"
              >
                Không hủy
              </button>
              <button
                type="button"
                onClick={() => void onCancel()}
                disabled={working}
                className="h-10 rounded-lg bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {working ? "Đang hủy..." : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
