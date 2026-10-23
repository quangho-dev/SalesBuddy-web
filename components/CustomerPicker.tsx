"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { createCustomer, type Customer } from "@/lib/api";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-60 dark:border-white/20 dark:focus:border-white/50";

const EMPTY_NEW = {
  company_name: "",
  phone_number: "",
  contact_person: "",
  tax_code: "",
};

export function customerLabel(
  customer?: Pick<Customer, "company_name" | "contact_person"> | null,
) {
  if (!customer) return "Khách hàng chưa chọn";
  return (
    customer.company_name.trim() ||
    customer.contact_person.trim() ||
    "Khách hàng chưa đặt tên"
  );
}

function customerOptionText(customer: Customer) {
  const phone = customer.phone_number.trim();
  return phone ? `${customerLabel(customer)} · ${phone}` : customerLabel(customer);
}

function matchesCustomerSearch(customer: Customer, needle: string) {
  const query = needle.trim().toLowerCase();
  if (!query) return true;
  const company = customer.company_name.toLowerCase();
  const phone = customer.phone_number.toLowerCase().replace(/[\s.+()-]/g, "");
  const digits = query.replace(/[\s.+()-]/g, "");
  return company.includes(query) || (digits.length > 0 && phone.includes(digits));
}

export function CustomerPicker({
  customers,
  selectedId,
  disabled,
  onSelect,
  onCreated,
  allowCreate = false,
  inputId = "customer-search",
  resultsId = "customer-results",
}: {
  customers: Customer[];
  selectedId: string;
  disabled?: boolean;
  onSelect: (customerId: string) => void;
  onCreated?: (customer: Customer) => void;
  allowCreate?: boolean;
  inputId?: string;
  resultsId?: string;
}) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState(EMPTY_NEW);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = customers.find((customer) => customer.id === selectedId) ?? null;
  const busy = disabled || saving;

  useEffect(() => {
    if (!selectedId) {
      setQuery("");
      setOpen(false);
      return;
    }
    const row = customers.find((customer) => customer.id === selectedId);
    if (row) {
      setQuery(row.company_name.trim() || row.phone_number.trim());
    }
  }, [customers, selectedId]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const matches = useMemo(() => {
    return customers.filter((customer) => matchesCustomerSearch(customer, query)).slice(0, 12);
  }, [customers, query]);

  function pick(customer: Customer) {
    onSelect(customer.id);
    setQuery(customer.company_name.trim() || customer.phone_number.trim());
    setOpen(false);
    setCreating(false);
  }

  function clearSelection() {
    onSelect("");
    setQuery("");
    setOpen(true);
  }

  function openCreateForm() {
    setCreating(true);
    setOpen(false);
    setCreateError(null);
    setNewCustomer({
      ...EMPTY_NEW,
      company_name: query.trim(),
    });
  }

  async function submitNewCustomer() {
    const company_name = newCustomer.company_name.trim();
    const phone_number = newCustomer.phone_number.trim();
    const contact_person = newCustomer.contact_person.trim();
    if (!company_name && !phone_number && !contact_person) {
      setCreateError("Nhập tên công ty, số điện thoại hoặc người liên hệ.");
      return;
    }

    setSaving(true);
    setCreateError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
      }
      const created = await createCustomer(token, {
        company_name,
        phone_number,
        contact_person,
        tax_code: newCustomer.tax_code.trim(),
        address: "",
        website: "",
        facebook: "",
        zalo: "",
        notes: "",
      });
      onCreated?.(created);
      pick(created);
      setNewCustomer(EMPTY_NEW);
      setCreating(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Không tạo được khách hàng.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1 text-sm sm:col-span-2">
      <label htmlFor={inputId}>Khách hàng</label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (!creating) setOpen(true);
          }}
          placeholder="Tìm theo tên công ty hoặc số điện thoại"
          className={inputClass}
          disabled={busy}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={resultsId}
        />
        {allowCreate ? (
          <button
            type="button"
            onClick={openCreateForm}
            disabled={busy}
            className="h-10 shrink-0 rounded-lg border border-black/15 px-3 text-sm disabled:opacity-50 dark:border-white/20"
          >
            Khách mới
          </button>
        ) : null}
        {selectedId ? (
          <button
            type="button"
            onClick={clearSelection}
            disabled={busy}
            className="h-10 shrink-0 rounded-lg border border-black/15 px-3 text-sm disabled:opacity-50 dark:border-white/20"
          >
            Xóa
          </button>
        ) : null}
      </div>
      {selected && !creating ? (
        <p className="text-xs text-black/55 dark:text-white/55">
          Đã chọn: {customerOptionText(selected)}
        </p>
      ) : !creating ? (
        <p className="text-xs text-black/55 dark:text-white/55">
          Gõ tên công ty hoặc số điện thoại để tìm, rồi chọn từ danh sách.
        </p>
      ) : null}

      {creating ? (
        <div className="mt-1 rounded-lg border border-black/15 p-3 dark:border-white/20">
          <p className="mb-2 text-sm font-medium">Khách hàng mới</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Tên công ty
              <input
                value={newCustomer.company_name}
                onChange={(event) =>
                  setNewCustomer((current) => ({
                    ...current,
                    company_name: event.target.value,
                  }))
                }
                className={inputClass}
                disabled={saving}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Số điện thoại
              <input
                value={newCustomer.phone_number}
                onChange={(event) =>
                  setNewCustomer((current) => ({
                    ...current,
                    phone_number: event.target.value,
                  }))
                }
                className={inputClass}
                disabled={saving}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Người liên hệ
              <input
                value={newCustomer.contact_person}
                onChange={(event) =>
                  setNewCustomer((current) => ({
                    ...current,
                    contact_person: event.target.value,
                  }))
                }
                className={inputClass}
                disabled={saving}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Mã số thuế
              <input
                value={newCustomer.tax_code}
                onChange={(event) =>
                  setNewCustomer((current) => ({
                    ...current,
                    tax_code: event.target.value,
                  }))
                }
                className={inputClass}
                disabled={saving}
              />
            </label>
          </div>
          {createError ? (
            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{createError}</p>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setCreateError(null);
              }}
              disabled={saving}
              className="h-9 rounded-lg border border-black/15 px-3 text-sm disabled:opacity-50 dark:border-white/20"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => void submitNewCustomer()}
              disabled={saving}
              className="h-9 rounded-lg bg-black px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {saving ? "Đang tạo..." : "Tạo và chọn"}
            </button>
          </div>
        </div>
      ) : null}

      {open && !busy && !creating ? (
        <ul
          id={resultsId}
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-black/15 bg-white py-1 shadow-lg dark:border-white/20 dark:bg-zinc-950"
        >
          {allowCreate ? (
            <li>
              <button
                type="button"
                onClick={openCreateForm}
                className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                Tạo khách hàng mới
                {query.trim() ? ` với “${query.trim()}”` : ""}
              </button>
            </li>
          ) : null}
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-black/55 dark:text-white/55">
              Không tìm thấy khách hàng phù hợp.
            </li>
          ) : (
            matches.map((customer) => {
              const active = customer.id === selectedId;
              return (
                <li key={customer.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(customer)}
                    className={`flex w-full flex-col px-3 py-2 text-left ${
                      active
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    <span className="truncate font-medium">{customerLabel(customer)}</span>
                    <span className={`truncate text-xs ${active ? "opacity-80" : "text-black/55 dark:text-white/55"}`}>
                      {customer.phone_number.trim() || "Chưa có số điện thoại"}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
