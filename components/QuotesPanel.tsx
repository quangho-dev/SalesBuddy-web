"use client";

import { CustomerPicker, customerLabel } from "@/components/CustomerPicker";
import { useAuth } from "@clerk/nextjs";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createQuote,
  deleteQuote,
  generateQuoteFile,
  getQuote,
  listCustomers,
  listProducts,
  listQuotes,
  updateQuote,
  type Customer,
  type GeneratedQuoteFile,
  type Product,
  type Quote,
  type QuoteInput,
} from "@/lib/api";

type ItemForm = {
  key: string;
  product_name: string;
  unit: string;
  quantity: string;
  selling_price: string;
  vat_invoice: boolean;
  notes: string;
  custom: boolean;
};

type FormState = {
  customer_id: string;
  notes: string;
  items: ItemForm[];
};

const ALL_CUSTOMERS = "";
const ALL_TYPES = "__all__";
const UNTYPED = "__untyped__";
const VAT_RATE = 0.1;
const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-60 dark:border-white/20 dark:focus:border-white/50";

type MoneyLine = {
  quantity: unknown;
  selling_price: unknown;
  vat_invoice?: boolean;
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPrice(value: unknown): string {
  return toNumber(value).toLocaleString("vi-VN");
}

function formatWhen(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function newItem(overrides: Partial<ItemForm> = {}): ItemForm {
  return {
    key: crypto.randomUUID(),
    product_name: "",
    unit: "",
    quantity: "1",
    selling_price: "0",
    vat_invoice: false,
    notes: "",
    custom: false,
    ...overrides,
  };
}

function emptyForm(customerId = ""): FormState {
  return { customer_id: customerId, notes: "", items: [newItem()] };
}

function quoteDriveLink(quote?: Quote | null) {
  return quote?.drive_web_link?.trim() || "";
}

function quoteCustomer(quote: Quote, customers: Customer[]) {
  return (
    quote.customers ??
    customers.find((customer) => customer.id === quote.customer_id) ??
    null
  );
}

function lineTotal(item: MoneyLine): number {
  return toNumber(item.quantity) * toNumber(item.selling_price);
}

function lineVat(item: MoneyLine): number {
  if (!item.vat_invoice) return 0;
  return Math.round(lineTotal(item) * VAT_RATE);
}

function summarizeQuote(items: MoneyLine[]) {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const vat = items.reduce((sum, item) => sum + lineVat(item), 0);
  return { subtotal, vat, grand: subtotal + vat };
}

function quoteLabel(quote: Quote) {
  const note = quote.notes.trim().split("\n")[0];
  if (note) return note;
  const first = quote.items?.[0]?.product_name?.trim();
  if (first) return first;
  return "Báo giá chưa đặt tên";
}

function fromQuote(quote: Quote, products: Product[] = []): FormState {
  return {
    customer_id: quote.customer_id ?? "",
    notes: quote.notes ?? "",
    items:
      quote.items?.length > 0
        ? quote.items.map((item) =>
            newItem({
              key: item.id || crypto.randomUUID(),
              product_name: item.product_name ?? "",
              unit: item.unit ?? "",
              quantity: String(toNumber(item.quantity)),
              selling_price: String(toNumber(item.selling_price)),
              vat_invoice: Boolean(item.vat_invoice),
              notes: item.notes ?? "",
              custom: !products.some(
                (product) =>
                  product.name.trim().toLowerCase() ===
                  (item.product_name ?? "").trim().toLowerCase(),
              ),
            }),
          )
        : [newItem()],
  };
}

function toPayload(form: FormState): QuoteInput {
  return {
    customer_id: form.customer_id,
    notes: form.notes,
    items: form.items
      .map((item) => ({
        product_name: item.product_name.trim(),
        unit: item.unit,
        quantity: toNumber(item.quantity),
        selling_price: toNumber(item.selling_price),
        vat_invoice: Boolean(item.vat_invoice),
        notes: item.notes,
      }))
      .filter((item) => item.product_name),
  };
}

function productLabel(product: Product) {
  return product.name.trim() || product.product_code.trim() || "Sản phẩm chưa đặt tên";
}

function matchesProductSearch(product: Product, needle: string) {
  const query = needle.trim().toLowerCase();
  if (!query) return true;
  return product.name.toLowerCase().includes(query);
}

function ProductSearch({
  products,
  value,
  disabled,
  placeholder,
  inputId,
  resultsId,
  onQueryChange,
  onPick,
  onUseCustom,
}: {
  products: Product[];
  value: string;
  disabled?: boolean;
  placeholder?: string;
  inputId: string;
  resultsId: string;
  onQueryChange: (value: string) => void;
  onPick: (product: Product) => void;
  onUseCustom?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
    return products.filter((product) => matchesProductSearch(product, value)).slice(0, 12);
  }, [products, value]);

  return (
    <div ref={rootRef} className="relative">
      <input
        id={inputId}
        value={value}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputClass}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={resultsId}
      />
      {open && !disabled && (products.length > 0 || (onUseCustom && value.trim())) ? (
        <ul
          id={resultsId}
          role="listbox"
          className="absolute top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-black/15 bg-white py-1 shadow-lg dark:border-white/20 dark:bg-zinc-950"
        >
          {onUseCustom && value.trim() ? (
            <li>
              <button
                type="button"
                onClick={() => {
                  onUseCustom(value.trim());
                  setOpen(false);
                }}
                className="flex w-full flex-col px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="truncate font-medium">Thêm “{value.trim()}”</span>
                <span className="truncate text-xs text-black/55 dark:text-white/55">
                  Hàng ngoài kho — phí vận chuyển, hàng mua ngoài...
                </span>
              </button>
            </li>
          ) : null}
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-black/55 dark:text-white/55">
              Không có sản phẩm cùng tên trong kho.
            </li>
          ) : (
            matches.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  role="option"
                  onClick={() => {
                    onPick(product);
                    setOpen(false);
                  }}
                  className="flex w-full flex-col px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span className="truncate font-medium">{productLabel(product)}</span>
                  <span className="truncate text-xs text-black/55 dark:text-white/55">
                    {[
                      product.product_code.trim() || null,
                      product.product_type.trim() || null,
                      product.unit.trim() || null,
                      `${formatPrice(product.selling_price)}đ`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export function QuotesPanel() {
  const { getToken } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState(ALL_CUSTOMERS);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<GeneratedQuoteFile | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = quotes.find((quote) => quote.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    let rows = quotes;
    if (customerFilter) {
      rows = rows.filter((quote) => quote.customer_id === customerFilter);
    }
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((quote) => {
      const customer = quoteCustomer(quote, customers);
      const haystack = [
        customerLabel(customer),
        customer?.phone_number ?? "",
        quote.notes,
        formatWhen(quote.created_at),
        ...(quote.items ?? []).map((item) => item.product_name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [customerFilter, customers, query, quotes]);

  const productTypes = useMemo(() => {
    const names = new Set<string>();
    let hasUntyped = false;
    for (const product of products) {
      const typeName = product.product_type.trim();
      if (typeName) names.add(typeName);
      else hasUntyped = true;
    }
    return {
      names: [...names].sort((left, right) => left.localeCompare(right, "vi")),
      hasUntyped,
    };
  }, [products]);

  const catalogProducts = useMemo(() => {
    if (typeFilter === UNTYPED) {
      return products.filter((product) => !product.product_type.trim());
    }
    if (typeFilter !== ALL_TYPES) {
      return products.filter((product) => product.product_type.trim() === typeFilter);
    }
    return products;
  }, [products, typeFilter]);

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
      const [quoteRows, customerRows, productRows] = await Promise.all([
        listQuotes(token),
        listCustomers(token),
        listProducts(token),
      ]);
      setQuotes(quoteRows);
      setCustomers(customerRows);
      setProducts(productRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách báo giá.");
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
    if (typeFilter === ALL_TYPES) return;
    if (typeFilter === UNTYPED && productTypes.hasUntyped) return;
    if (productTypes.names.includes(typeFilter)) return;
    setTypeFilter(ALL_TYPES);
  }, [productTypes.hasUntyped, productTypes.names, typeFilter]);

  function openCreate() {
    setCreating(true);
    setSelectedId(null);
    setForm(emptyForm(customerFilter));
    setCatalogQuery("");
    setConfirmDelete(false);
    setGeneratedFile(null);
    setError(null);
  }

  async function openQuote(quoteId: string) {
    setCreating(false);
    setSelectedId(quoteId);
    setCatalogQuery("");
    setConfirmDelete(false);
    setGeneratedFile(null);
    setError(null);
    const listed = quotes.find((quote) => quote.id === quoteId);
    if (listed) setForm(fromQuote(listed, products));

    try {
      const token = await withToken();
      const detail = await getQuote(token, quoteId);
      setQuotes((current) =>
        current.map((quote) => (quote.id === detail.id ? detail : quote)),
      );
      setForm(fromQuote(detail, products));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chi tiết báo giá.");
    }
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateItem<K extends keyof ItemForm>(
    key: string,
    field: K,
    value: ItemForm[K],
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function removeItem(key: string) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((item) => item.key !== key),
    }));
  }

  function addCustomItem(name = "") {
    setForm((current) => ({
      ...current,
      items: [...current.items, newItem({ product_name: name, custom: true })],
    }));
  }

  function applyVatToAllItems() {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => ({ ...item, vat_invoice: true })),
    }));
  }

  function addFromCatalog(product: Product) {
    setCatalogQuery("");
    const filled = newItem({
      product_name: product.name,
      unit: product.unit,
      selling_price: String(toNumber(product.selling_price)),
    });
    setForm((current) => {
      const blank = current.items.find((item) => !item.product_name.trim());
      if (!blank) {
        return { ...current, items: [...current.items, filled] };
      }
      return {
        ...current,
        items: current.items.map((item) => (item.key === blank.key ? filled : item)),
      };
    });
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = toPayload(form);
    if (!payload.customer_id) {
      setError("Hãy chọn khách hàng.");
      return;
    }
    if (payload.items.length === 0) {
      setError("Báo giá cần ít nhất một sản phẩm.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await withToken();
      if (creating) {
        const created = await createQuote(token, payload);
        setQuotes((current) => [created, ...current]);
        setCreating(false);
        setSelectedId(created.id);
        setForm(fromQuote(created, products));
      } else if (selectedId) {
        const updated = await updateQuote(token, selectedId, payload);
        setQuotes((current) =>
          current.map((quote) => (quote.id === updated.id ? updated : quote)),
        );
        setForm(fromQuote(updated, products));
      }
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được báo giá.");
    } finally {
      setSaving(false);
    }
  }

  async function onGenerateFile() {
    const payload = toPayload(form);
    if (!payload.customer_id) {
      setError("Hãy chọn khách hàng trước khi tạo file.");
      return;
    }
    if (payload.items.length === 0) {
      setError("Báo giá cần ít nhất một sản phẩm.");
      return;
    }

    const customer = customers.find((row) => row.id === payload.customer_id);
    setGenerating(true);
    setGeneratedFile(null);
    setError(null);
    try {
      const token = await withToken();
      let quoteId = creating ? "" : selectedId ?? "";
      let quoteDate = creating
        ? undefined
        : quotes.find((quote) => quote.id === selectedId)?.created_at;
      if (creating) {
        const created = await createQuote(token, payload);
        setQuotes((current) => [created, ...current]);
        setCreating(false);
        setSelectedId(created.id);
        setForm(fromQuote(created, products));
        quoteId = created.id;
        quoteDate = created.created_at;
      }
      const file = await generateQuoteFile(token, {
        quote_id: quoteId || undefined,
        quote_date: quoteDate,
        customer: customer
          ? {
              company_name: customer.company_name,
              contact_person: customer.contact_person,
              address: customer.address,
              phone_number: customer.phone_number,
            }
          : undefined,
        notes: payload.notes,
        items: payload.items,
      });
      setGeneratedFile(file);
      if (quoteId) {
        setQuotes((current) =>
          current.map((quote) =>
            quote.id === quoteId
              ? {
                  ...quote,
                  drive_file_id: file.file_id,
                  drive_file_name: file.file_name,
                  drive_web_link: file.web_link,
                }
              : quote,
          ),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tạo được file báo giá.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const token = await withToken();
      await deleteQuote(token, selectedId);
      setQuotes((current) => current.filter((quote) => quote.id !== selectedId));
      setSelectedId(null);
      setCreating(false);
      setForm(emptyForm(customerFilter));
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được báo giá.");
    } finally {
      setSaving(false);
    }
  }

  const showEditor = creating || selectedId !== null;
  const selectedCustomer = selected ? quoteCustomer(selected, customers) : null;
  const title = creating
    ? "Báo giá mới"
    : selected
      ? `${customerLabel(selectedCustomer)} · ${quoteLabel(selected)}`
      : "Chi tiết báo giá";
  const totals = summarizeQuote(form.items);
  const busy = saving || generating;
  const driveLink = quoteDriveLink(selected) || generatedFile?.web_link || "";

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-black/10 px-6 py-4 dark:border-white/10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Báo giá</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Tạo báo giá theo khách hàng, nhiều sản phẩm, VAT và file Google Sheet từ mẫu bao-gia.xls.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="h-10 shrink-0 rounded-lg bg-black px-4 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Thêm báo giá
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
            <label htmlFor="quote-search" className="sr-only">
              Tìm báo giá
            </label>
            <input
              id="quote-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm khách, ghi chú, sản phẩm..."
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
                {quotes.length === 0
                  ? "Chưa có báo giá. Bấm “Thêm báo giá” để tạo mới."
                  : customerFilter
                    ? "Khách hàng này chưa có báo giá."
                    : "Không tìm thấy báo giá phù hợp."}
              </li>
            ) : (
              filtered.map((quote) => {
                const active = quote.id === selectedId && !creating;
                const items = quote.items ?? [];
                const fileLink = quoteDriveLink(quote);
                return (
                  <li key={quote.id}>
                    <div
                      className={`rounded-lg ${
                        active
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void openQuote(quote.id)}
                        className="w-full px-3 py-3 text-left"
                      >
                        <p className="truncate text-sm font-bold">
                          {customerLabel(quoteCustomer(quote, customers))}
                        </p>
                        <p className="mt-0.5 truncate text-xs">
                          <span className={active ? "opacity-80" : "text-black/55 dark:text-white/55"}>
                            {formatWhen(quote.created_at)}
                            {items.some((item) => item.vat_invoice) ? " · VAT" : ""}
                            {" · "}
                            {items.length} SP
                            {" · "}
                          </span>
                          <span className="font-bold">
                            {formatPrice(quote.grand_total ?? summarizeQuote(items).grand)}đ
                          </span>
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
                      {fileLink ? (
                        <a
                          href={fileLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className={`mx-3 mb-3 inline-flex text-xs font-medium underline ${
                            active ? "opacity-90" : "text-black/70 dark:text-white/70"
                          }`}
                        >
                          Xem file Drive
                        </a>
                      ) : null}
                    </div>
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
              Chọn một báo giá hoặc thêm báo giá mới.
            </div>
          ) : (
            <form onSubmit={onSave} className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-6 py-6">
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
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {driveLink ? (
                    <a
                      href={driveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
                    >
                      Xem file Drive
                    </a>
                  ) : null}
                  {!creating && selectedId ? (
                    confirmDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-700 dark:text-red-300">Xóa báo giá này?</span>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
                          disabled={busy}
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete()}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                          disabled={busy}
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
              </div>

              {error ? (
                <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {error}
                </p>
              ) : null}

              {generating ? (
                <p className="rounded-lg border border-black/15 px-3 py-2 text-sm text-black/70 dark:border-white/20 dark:text-white/70">
                  Đang copy mẫu bao-gia.xls và điền dữ liệu. Việc này có thể mất khoảng một phút.
                </p>
              ) : null}

              {generatedFile ? (
                <div className="rounded-lg border border-black/15 bg-black/[0.03] px-3 py-3 text-sm dark:border-white/20 dark:bg-white/[0.04]">
                  <p className="font-medium">Đã tạo file từ mẫu bao-gia.xls</p>
                  <p className="mt-1 truncate text-black/70 dark:text-white/70">
                    {generatedFile.file_name}
                    {generatedFile.sheet_name
                      ? ` · sheet ${generatedFile.sheet_name}`
                      : ""}
                  </p>
                  {generatedFile.summary ? (
                    <p className="mt-1 text-black/60 dark:text-white/60">
                      {generatedFile.summary}
                    </p>
                  ) : null}
                  <a
                    href={generatedFile.web_link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex h-9 items-center rounded-md bg-black px-3 text-sm font-medium text-white dark:bg-white dark:text-black"
                  >
                    Mở Google Sheet
                  </a>
                </div>
              ) : null}

              <CustomerPicker
                customers={customers}
                selectedId={form.customer_id}
                disabled={busy}
                allowCreate
                inputId="quote-customer-search"
                resultsId="quote-customer-results"
                onSelect={(customerId) => updateField("customer_id", customerId)}
                onCreated={(customer) => {
                  setCustomers((current) => [
                    customer,
                    ...current.filter((row) => row.id !== customer.id),
                  ]);
                  updateField("customer_id", customer.id);
                }}
              />

              <label className="flex flex-col gap-1 text-sm">
                Ghi chú báo giá
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  rows={3}
                  className={inputClass}
                  disabled={busy}
                />
              </label>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h3 className="text-sm font-semibold">Sản phẩm</h3>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {products.length > 0 ? (
                      <>
                        <label className="flex w-44 flex-col gap-1 text-sm">
                          Loại sản phẩm
                          <select
                            value={typeFilter}
                            onChange={(event) => setTypeFilter(event.target.value)}
                            className={inputClass}
                            disabled={busy}
                          >
                            <option value={ALL_TYPES}>Tất cả</option>
                            {productTypes.names.map((typeName) => (
                              <option key={typeName} value={typeName}>
                                {typeName}
                              </option>
                            ))}
                            {productTypes.hasUntyped ? (
                              <option value={UNTYPED}>Chưa phân loại</option>
                            ) : null}
                          </select>
                        </label>
                        <div className="w-64">
                          <label htmlFor="quote-catalog-search" className="sr-only">
                            Tìm sản phẩm theo tên
                          </label>
                          <ProductSearch
                            products={catalogProducts}
                            value={catalogQuery}
                            disabled={busy}
                            placeholder="Tìm sản phẩm theo tên"
                            inputId="quote-catalog-search"
                            resultsId="quote-catalog-results"
                            onQueryChange={setCatalogQuery}
                            onPick={addFromCatalog}
                            onUseCustom={(name) => {
                              addCustomItem(name);
                              setCatalogQuery("");
                            }}
                          />
                        </div>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => addCustomItem()}
                      disabled={busy}
                      className="h-10 rounded-lg border border-black/15 px-3 text-sm disabled:opacity-50 dark:border-white/20"
                    >
                      Thêm hàng khác
                    </button>
                    <button
                      type="button"
                      onClick={applyVatToAllItems}
                      disabled={saving || form.items.length === 0}
                      className="h-10 rounded-lg border border-black/15 px-3 text-sm disabled:opacity-50 dark:border-white/20"
                    >
                      Tính VAT tất cả
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {form.items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-black/15 px-3 py-6 text-center text-sm text-black/55 dark:border-white/20 dark:text-white/55">
                      Chưa có sản phẩm. Tìm hàng trong kho hoặc bấm “Thêm hàng khác”.
                    </p>
                  ) : null}
                  {form.items.map((item, index) => (
                    <div
                      key={item.key}
                      className="overflow-visible rounded-xl border border-black/10 p-3 dark:border-white/15"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-black/60 dark:text-white/60">
                          Dòng {index + 1}
                          {item.custom ? " · Hàng ngoài kho" : ""}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          disabled={busy}
                          className="text-xs text-red-700 disabled:opacity-40 dark:text-red-300"
                        >
                          Xóa dòng
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                        <label className="flex flex-col gap-1 text-sm lg:col-span-4">
                          Tên hàng
                          {item.custom ? (
                            <input
                              value={item.product_name}
                              onChange={(event) =>
                                updateItem(item.key, "product_name", event.target.value)
                              }
                              placeholder="Phí vận chuyển, hàng mua ngoài..."
                              className={inputClass}
                              disabled={busy}
                            />
                          ) : (
                            <ProductSearch
                              products={catalogProducts}
                              value={item.product_name}
                              disabled={busy}
                              placeholder="Tìm hoặc gõ tên hàng"
                              inputId={`quote-item-name-${item.key}`}
                              resultsId={`quote-item-results-${item.key}`}
                              onQueryChange={(value) =>
                                updateItem(item.key, "product_name", value)
                              }
                              onPick={(product) => {
                                setForm((current) => ({
                                  ...current,
                                  items: current.items.map((row) =>
                                    row.key === item.key
                                      ? {
                                          ...row,
                                          product_name: product.name,
                                          unit: product.unit,
                                          selling_price: String(toNumber(product.selling_price)),
                                          custom: false,
                                        }
                                      : row,
                                  ),
                                }));
                              }}
                              onUseCustom={(name) => {
                                setForm((current) => ({
                                  ...current,
                                  items: current.items.map((row) =>
                                    row.key === item.key
                                      ? { ...row, product_name: name, custom: true }
                                      : row,
                                  ),
                                }));
                              }}
                            />
                          )}
                        </label>
                        <label className="flex flex-col gap-1 text-sm lg:col-span-2">
                          Đơn vị
                          <input
                            value={item.unit}
                            onChange={(event) => updateItem(item.key, "unit", event.target.value)}
                            className={inputClass}
                            disabled={busy}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm lg:col-span-2">
                          Số lượng
                          <input
                            type="number"
                            step="any"
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(item.key, "quantity", event.target.value)
                            }
                            className={inputClass}
                            disabled={busy}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm lg:col-span-2">
                          Giá sản phẩm
                          <input
                            type="number"
                            step="any"
                            value={item.selling_price}
                            onChange={(event) =>
                              updateItem(item.key, "selling_price", event.target.value)
                            }
                            className={inputClass}
                            disabled={busy}
                          />
                        </label>
                        <div className="flex flex-col justify-end text-sm lg:col-span-2">
                          <p className="text-xs text-black/55 dark:text-white/55">Thành tiền</p>
                          <p className="py-2 text-sm font-bold">
                            {formatPrice(lineTotal(item))}đ
                          </p>
                        </div>
                        <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-6">
                          <input
                            type="checkbox"
                            checked={item.vat_invoice}
                            onChange={(event) =>
                              updateItem(item.key, "vat_invoice", event.target.checked)
                            }
                            disabled={busy}
                          />
                          Tính VAT (10%)
                        </label>
                        <div className="flex flex-col justify-end text-sm sm:col-span-2 lg:col-span-6">
                          {item.vat_invoice ? (
                            <>
                              <p className="text-xs text-black/55 dark:text-white/55">
                                VAT 10%: {formatPrice(lineVat(item))}đ
                              </p>
                              <p className="text-sm font-bold">
                                Cộng: {formatPrice(lineTotal(item) + lineVat(item))}đ
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-black/55 dark:text-white/55">
                              Không tính VAT
                            </p>
                          )}
                        </div>
                        <label className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-12">
                          Ghi chú sản phẩm
                          <input
                            value={item.notes}
                            onChange={(event) => updateItem(item.key, "notes", event.target.value)}
                            className={inputClass}
                            disabled={busy}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
                  <p className="flex justify-between gap-4">
                    <span className="text-black/60 dark:text-white/60">Tạm tính</span>
                    <span>{formatPrice(totals.subtotal)}đ</span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span className="text-black/60 dark:text-white/60">Thuế VAT (10%)</span>
                    <span>{formatPrice(totals.vat)}đ</span>
                  </p>
                  <p className="flex justify-between gap-4 font-bold">
                    <span>Tổng báo giá</span>
                    <span>{formatPrice(totals.grand)}đ</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void onGenerateFile()}
                  disabled={busy}
                  className="h-10 rounded-lg border border-black/15 px-4 text-sm font-medium disabled:opacity-50 dark:border-white/20"
                >
                  {generating
                    ? "Đang tạo file..."
                    : "Tạo file Google Sheet"}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="h-10 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {saving ? "Đang lưu..." : creating ? "Tạo báo giá" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
