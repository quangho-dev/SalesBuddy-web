"use client";

import { useAuth } from "@clerk/nextjs";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
  type Customer,
  type CustomerInput,
  type CustomerInteraction,
} from "@/lib/api";

type FormState = Omit<CustomerInput, "interaction_history">;

const EMPTY_FORM: FormState = {
  company_name: "",
  contact_person: "",
  address: "",
  phone_number: "",
  website: "",
  facebook: "",
  zalo: "",
  notes: "",
};

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-60 dark:border-white/20 dark:focus:border-white/50";

function customerLabel(customer: Pick<Customer, "company_name" | "contact_person">) {
  return customer.company_name.trim() || customer.contact_person.trim() || "Khách hàng chưa đặt tên";
}

function fromCustomer(customer: Customer): FormState {
  return {
    company_name: customer.company_name ?? "",
    contact_person: customer.contact_person ?? "",
    address: customer.address ?? "",
    phone_number: customer.phone_number ?? "",
    website: customer.website ?? "",
    facebook: customer.facebook ?? "",
    zalo: customer.zalo ?? "",
    notes: customer.notes ?? "",
  };
}

function formatWhen(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

export function CustomersPanel() {
  const { getToken } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [history, setHistory] = useState<CustomerInteraction[]>([]);
  const [newInteraction, setNewInteraction] = useState("");
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = customers.find((customer) => customer.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((customer) =>
      [
        customer.company_name,
        customer.contact_person,
        customer.phone_number,
        customer.address,
        customer.zalo,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [customers, query]);

  const withToken = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
    }
    return token;
  }, [getToken]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const token = await withToken();
      const rows = await listCustomers(token);
      setCustomers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách khách hàng.");
    } finally {
      setLoadingList(false);
    }
  }, [withToken]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function openCreate() {
    setCreating(true);
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setHistory([]);
    setNewInteraction("");
    setConfirmDelete(false);
    setError(null);
  }

  async function openCustomer(customerId: string) {
    setCreating(false);
    setSelectedId(customerId);
    setConfirmDelete(false);
    setNewInteraction("");
    setError(null);
    const listed = customers.find((customer) => customer.id === customerId);
    if (listed) {
      setForm(fromCustomer(listed));
      setHistory(listed.interaction_history ?? []);
    }
    try {
      const token = await withToken();
      const detail = await getCustomer(token, customerId);
      setCustomers((current) =>
        current.map((customer) => (customer.id === detail.id ? detail : customer)),
      );
      setForm(fromCustomer(detail));
      setHistory(detail.interaction_history ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chi tiết khách hàng.");
    }
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const token = await withToken();
      if (creating) {
        const created = await createCustomer(token, {
          ...form,
          interaction_history: history,
        });
        setCustomers((current) => [created, ...current]);
        setCreating(false);
        setSelectedId(created.id);
        setForm(fromCustomer(created));
        setHistory(created.interaction_history ?? []);
      } else if (selectedId) {
        const updated = await updateCustomer(token, selectedId, form);
        setCustomers((current) =>
          current.map((customer) => (customer.id === updated.id ? updated : customer)),
        );
        setForm(fromCustomer(updated));
        setHistory(updated.interaction_history ?? history);
      }
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được khách hàng.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const token = await withToken();
      await deleteCustomer(token, selectedId);
      setCustomers((current) => current.filter((customer) => customer.id !== selectedId));
      setSelectedId(null);
      setCreating(false);
      setForm(EMPTY_FORM);
      setHistory([]);
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được khách hàng.");
    } finally {
      setSaving(false);
    }
  }

  async function addInteraction() {
    const content = newInteraction.trim();
    if (!content) return;

    const nextHistory = [...history, { content }];
    if (creating || !selectedId) {
      setHistory(nextHistory);
      setNewInteraction("");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await withToken();
      const updated = await updateCustomer(token, selectedId, {
        interaction_history: nextHistory,
      });
      setCustomers((current) =>
        current.map((customer) => (customer.id === updated.id ? updated : customer)),
      );
      setHistory(updated.interaction_history ?? nextHistory);
      setNewInteraction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thêm được lịch sử tương tác.");
    } finally {
      setSaving(false);
    }
  }

  async function removeInteraction(index: number) {
    const nextHistory = history.filter((_, itemIndex) => itemIndex !== index);
    if (creating || !selectedId) {
      setHistory(nextHistory);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await withToken();
      const updated = await updateCustomer(token, selectedId, {
        interaction_history: nextHistory,
      });
      setCustomers((current) =>
        current.map((customer) => (customer.id === updated.id ? updated : customer)),
      );
      setHistory(updated.interaction_history ?? nextHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được lịch sử tương tác.");
    } finally {
      setSaving(false);
    }
  }

  const showEditor = creating || selectedId !== null;
  const title = creating
    ? "Khách hàng mới"
    : selected
      ? customerLabel(selected)
      : "Chi tiết khách hàng";

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-black/10 px-6 py-4 dark:border-white/10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Khách hàng</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Thêm, sửa, xóa và xem lịch sử tương tác.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="h-10 shrink-0 rounded-lg bg-black px-4 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Thêm khách hàng
        </button>
      </header>

      {error && !showEditor ? (
        <p className="border-b border-red-300 bg-red-50 px-6 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <aside
          className={`flex w-full min-h-0 flex-col border-r border-black/10 md:w-80 dark:border-white/10 ${
            showEditor ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="border-b border-black/10 p-4 dark:border-white/10">
            <label htmlFor="customer-search" className="sr-only">
              Tìm khách hàng
            </label>
            <input
              id="customer-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm công ty, người liên hệ..."
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
                {customers.length === 0
                  ? "Chưa có khách hàng. Bấm “Thêm khách hàng” để tạo mới."
                  : "Không tìm thấy khách hàng phù hợp."}
              </li>
            ) : (
              filtered.map((customer) => {
                const active = customer.id === selectedId && !creating;
                return (
                  <li key={customer.id}>
                    <button
                      type="button"
                      onClick={() => void openCustomer(customer.id)}
                      className={`w-full rounded-lg px-3 py-3 text-left ${
                        active
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                    >
                      <p className="truncate text-sm font-medium">
                        {customerLabel(customer)}
                      </p>
                      <p
                        className={`mt-0.5 truncate text-xs ${
                          active ? "opacity-80" : "text-black/55 dark:text-white/55"
                        }`}
                      >
                        {customer.contact_person && customer.company_name
                          ? customer.contact_person
                          : customer.phone_number || customer.address || "Chưa có thông tin liên hệ"}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section
          className={`min-h-0 min-w-0 flex-1 overflow-y-auto ${
            showEditor ? "block" : "hidden md:block"
          }`}
        >
          {!showEditor ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-black/55 dark:text-white/55">
              Chọn một khách hàng hoặc thêm khách hàng mới.
            </div>
          ) : (
            <form onSubmit={onSave} className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setSelectedId(null);
                      setConfirmDelete(false);
                    }}
                    className="rounded-md border border-black/15 px-2 py-1 text-sm md:hidden dark:border-white/20"
                  >
                    Danh sách
                  </button>
                  <h2 className="text-base font-semibold tracking-tight">{title}</h2>
                </div>
                {!creating && selectedId ? (
                  confirmDelete ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-700 dark:text-red-300">Xóa khách hàng này?</span>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
                        disabled={saving}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete()}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        disabled={saving}
                      >
                        Xóa
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
                    >
                      Xóa
                    </button>
                  )
                ) : null}
              </div>

              {error ? (
                <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  Tên công ty
                  <input
                    value={form.company_name}
                    onChange={(event) => updateField("company_name", event.target.value)}
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Người liên hệ
                  <input
                    value={form.contact_person}
                    onChange={(event) => updateField("contact_person", event.target.value)}
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  Địa chỉ
                  <input
                    value={form.address}
                    onChange={(event) => updateField("address", event.target.value)}
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Số điện thoại
                  <input
                    value={form.phone_number}
                    onChange={(event) => updateField("phone_number", event.target.value)}
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Zalo
                  <input
                    value={form.zalo}
                    onChange={(event) => updateField("zalo", event.target.value)}
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Website
                  <input
                    value={form.website}
                    onChange={(event) => updateField("website", event.target.value)}
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Facebook
                  <input
                    value={form.facebook}
                    onChange={(event) => updateField("facebook", event.target.value)}
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  Ghi chú
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    rows={3}
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {saving ? "Đang lưu..." : creating ? "Tạo khách hàng" : "Lưu thay đổi"}
                </button>
              </div>

              <section className="border-t border-black/10 pt-5 dark:border-white/10">
                <h3 className="text-sm font-semibold">Lịch sử tương tác</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {history.length === 0 ? (
                    <li className="text-sm text-black/50 dark:text-white/50">
                      Chưa có lịch sử tương tác.
                    </li>
                  ) : (
                    history.map((item, index) => (
                      <li
                        key={item.id ?? `${item.content}-${index}`}
                        className="flex items-start justify-between gap-3 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15"
                      >
                        <div>
                          <p className="whitespace-pre-wrap">{item.content}</p>
                          {item.created_at ? (
                            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                              {formatWhen(item.created_at)}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                              Sẽ lưu khi tạo khách hàng
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeInteraction(index)}
                          className="shrink-0 text-xs text-red-700 dark:text-red-300"
                          disabled={saving}
                        >
                          Xóa
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <div className="mt-3 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1 text-sm">
                    <span className="sr-only">Thêm tương tác</span>
                    <textarea
                      value={newInteraction}
                      onChange={(event) => setNewInteraction(event.target.value)}
                      rows={2}
                      placeholder="Ghi lại cuộc gọi, tin nhắn, lần gặp..."
                      className={inputClass}
                      disabled={saving}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void addInteraction()}
                    disabled={saving || newInteraction.trim().length === 0}
                    className="h-10 w-full shrink-0 rounded-lg border border-black/15 px-3 text-sm disabled:opacity-50 sm:w-auto dark:border-white/20"
                  >
                    Thêm
                  </button>
                </div>
              </section>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
