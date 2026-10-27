"use client";

import { useAuth } from "@clerk/nextjs";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProduct,
  deleteProduct,
  downloadProductTemplate,
  getProduct,
  importProducts,
  listProducts,
  updateProduct,
  type Product,
  type ProductInput,
} from "@/lib/api";

type FormState = {
  product_code: string;
  name: string;
  product_type: string;
  unit: string;
  selling_price: string;
  stock: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  product_code: "",
  name: "",
  product_type: "",
  unit: "",
  selling_price: "0",
  stock: "0",
  notes: "",
};

const ALL_TYPES = "__all__";
const UNTYPED = "__untyped__";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-60 dark:border-white/20 dark:focus:border-white/50";

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPrice(value: unknown): string {
  return toNumber(value).toLocaleString("vi-VN");
}

function productLabel(product: Pick<Product, "name" | "product_code">) {
  return product.name.trim() || product.product_code.trim() || "Sản phẩm chưa đặt tên";
}

function fromProduct(product: Product): FormState {
  return {
    product_code: product.product_code ?? "",
    name: product.name ?? "",
    product_type: product.product_type ?? "",
    unit: product.unit ?? "",
    selling_price: String(toNumber(product.selling_price)),
    stock: String(toNumber(product.stock)),
    notes: product.notes ?? "",
  };
}

function toPayload(form: FormState): ProductInput {
  return {
    product_code: form.product_code,
    name: form.name,
    product_type: form.product_type,
    unit: form.unit,
    selling_price: toNumber(form.selling_price),
    stock: toNumber(form.stock),
    notes: form.notes,
  };
}

export function ProductsPanel() {
  const { getToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = products.find((product) => product.id === selectedId) ?? null;

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

  const filtered = useMemo(() => {
    let rows = products;
    if (typeFilter === UNTYPED) {
      rows = rows.filter((product) => !product.product_type.trim());
    } else if (typeFilter !== ALL_TYPES) {
      rows = rows.filter((product) => product.product_type.trim() === typeFilter);
    }
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((product) =>
      [product.name, product.product_code, product.product_type, product.unit, product.notes]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [products, query, typeFilter]);

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
      setProducts(await listProducts(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách sản phẩm.");
    } finally {
      setLoadingList(false);
    }
  }, [withToken]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (typeFilter === ALL_TYPES) return;
    if (typeFilter === UNTYPED && productTypes.hasUntyped) return;
    if (productTypes.names.includes(typeFilter)) return;
    setTypeFilter(ALL_TYPES);
  }, [productTypes.hasUntyped, productTypes.names, typeFilter]);

  function openCreate() {
    setCreating(true);
    setSelectedId(null);
    setForm({
      ...EMPTY_FORM,
      product_type:
        typeFilter !== ALL_TYPES && typeFilter !== UNTYPED ? typeFilter : "",
    });
    setConfirmDelete(false);
    setError(null);
  }

  async function openProduct(productId: string) {
    setCreating(false);
    setSelectedId(productId);
    setConfirmDelete(false);
    setError(null);
    const listed = products.find((product) => product.id === productId);
    if (listed) setForm(fromProduct(listed));

    try {
      const token = await withToken();
      const detail = await getProduct(token, productId);
      setProducts((current) =>
        current.map((product) => (product.id === detail.id ? detail : product)),
      );
      setForm(fromProduct(detail));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chi tiết sản phẩm.");
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
      const payload = toPayload(form);
      if (creating) {
        const created = await createProduct(token, payload);
        setProducts((current) => [created, ...current]);
        setCreating(false);
        setSelectedId(created.id);
        setForm(fromProduct(created));
      } else if (selectedId) {
        const updated = await updateProduct(token, selectedId, payload);
        setProducts((current) =>
          current.map((product) => (product.id === updated.id ? updated : product)),
        );
        setForm(fromProduct(updated));
      }
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được sản phẩm.");
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
      await deleteProduct(token, selectedId);
      setProducts((current) => current.filter((product) => product.id !== selectedId));
      setSelectedId(null);
      setCreating(false);
      setForm(EMPTY_FORM);
      setConfirmDelete(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được sản phẩm.");
    } finally {
      setSaving(false);
    }
  }

  async function onDownloadTemplate() {
    setError(null);
    try {
      const token = await withToken();
      await downloadProductTemplate(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được file mẫu.");
    }
  }

  async function onImportFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Chỉ hỗ trợ file .xlsx");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const token = await withToken();
      const result = await importProducts(token, file);
      setProducts((current) => [...result.products, ...current]);
      const errorCount = result.errors.length;
      const notes = [
        result.duplicates
          ? `bỏ qua ${result.duplicates} sản phẩm trùng mã và tên`
          : "",
        result.skipped ? `bỏ qua ${result.skipped} dòng trống` : "",
        errorCount ? `${errorCount} dòng lỗi` : "",
      ].filter(Boolean);
      setNotice(
        `Đã import ${result.imported} sản phẩm` +
          (notes.length ? `, ${notes.join(", ")}` : "") +
          ".",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không import được file Excel.");
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const showEditor = creating || selectedId !== null;
  const title = creating
    ? "Sản phẩm mới"
    : selected
      ? productLabel(selected)
      : "Chi tiết sản phẩm";

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-black/10 px-6 py-4 dark:border-white/10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Sản phẩm</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Thêm, sửa, xóa mã, đơn vị tính, giá bán và tồn kho.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImportFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => void onDownloadTemplate()}
            disabled={saving}
            className="h-10 rounded-lg border border-black/15 px-4 text-sm disabled:opacity-50 dark:border-white/20"
          >
            Tải mẫu Excel
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            className="h-10 rounded-lg border border-black/15 px-4 text-sm disabled:opacity-50 dark:border-white/20"
          >
            {saving ? "Đang xử lý..." : "Import Excel"}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="h-10 rounded-lg bg-black px-4 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Thêm sản phẩm
          </button>
        </div>
      </header>

      {error && !showEditor ? (
        <p className="border-b border-red-300 bg-red-50 px-6 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="border-b border-emerald-300 bg-emerald-50 px-6 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {notice}
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
              Loại sản phẩm
              <select
                id="product-type-filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className={inputClass}
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
            <label htmlFor="product-search" className="sr-only">
              Tìm sản phẩm
            </label>
            <input
              id="product-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên, mã sản phẩm..."
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
                {products.length === 0
                  ? "Chưa có sản phẩm. Bấm “Thêm sản phẩm” để tạo mới."
                  : typeFilter !== ALL_TYPES
                    ? "Không có sản phẩm cùng loại này."
                    : "Không tìm thấy sản phẩm phù hợp."}
              </li>
            ) : (
              filtered.map((product) => {
                const active = product.id === selectedId && !creating;
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => void openProduct(product.id)}
                      className={`w-full rounded-lg px-3 py-3 text-left ${
                        active
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                    >
                      <p className="truncate text-sm font-bold">{productLabel(product)}</p>
                      <p className="mt-0.5 truncate text-xs">
                        {product.product_code || product.product_type || product.unit ? (
                          <span className={active ? "opacity-80" : "text-black/55 dark:text-white/55"}>
                            {[
                              product.product_code || null,
                              product.product_type || null,
                              product.unit || null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            {" · "}
                          </span>
                        ) : null}
                        <span className="font-bold">{formatPrice(product.selling_price)}đ</span>
                        <span>
                          {" · tồn "}
                          <span className="font-bold">
                            {formatPrice(product.stock)}
                            {product.unit.trim() ? ` ${product.unit.trim()}` : ""}
                          </span>
                        </span>
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
              Chọn một sản phẩm hoặc thêm sản phẩm mới.
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
                      <span className="text-xs text-red-700 dark:text-red-300">Xóa sản phẩm này?</span>
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
                  Mã sản phẩm
                  <input
                    value={form.product_code}
                    onChange={(event) => updateField("product_code", event.target.value)}
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Tên sản phẩm
                  <input
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Loại sản phẩm
                  <input
                    value={form.product_type}
                    onChange={(event) => updateField("product_type", event.target.value)}
                    placeholder="inox tấm, ống, phụ kiện..."
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Đơn vị tính
                  <input
                    value={form.unit}
                    onChange={(event) => updateField("unit", event.target.value)}
                    placeholder="tấm, kg, cây..."
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Giá bán
                  <input
                    type="number"
                    step="any"
                    value={form.selling_price}
                    onChange={(event) => updateField("selling_price", event.target.value)}
                    className={inputClass}
                    disabled={saving}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Tồn kho
                  <input
                    type="number"
                    step="any"
                    value={form.stock}
                    onChange={(event) => updateField("stock", event.target.value)}
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
                  {saving ? "Đang lưu..." : creating ? "Tạo sản phẩm" : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
