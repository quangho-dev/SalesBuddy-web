"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  deleteDocument,
  embedDocument,
  listDocuments,
  uploadDocument,
  type SalesDocument,
} from "@/lib/api";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = [".pdf", ".docx", ".pptx", ".txt", ".md"];

const STATUS_LABEL: Record<string, string> = {
  pending: "Đang chờ",
  processing: "Đang xử lý",
  ready: "Sẵn sàng",
  failed: "Lỗi",
};

const STEP_LABEL: Record<string, string> = {
  pending: "Đang chờ embed",
  processing: "Đang bắt đầu",
  partitioning: "Đang tách nội dung",
  chunking: "Đang chia đoạn",
  summarising: "Đang tóm tắt",
  vectorization: "Đang embed",
  completed: "Đã embed",
  failed: "Embed thất bại",
};

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isBusy(document: SalesDocument) {
  return document.status === "pending" || document.status === "processing";
}

function statusText(document: SalesDocument) {
  if (document.status === "ready") {
    return `Sẵn sàng · ${document.chunk_count} đoạn`;
  }
  const step = document.processing_status ? STEP_LABEL[document.processing_status] : "";
  return step || STATUS_LABEL[document.status] || document.status;
}

function statusClass(status: string) {
  if (status === "ready") {
    return "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (status === "failed") {
    return "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200";
  }
  return "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100";
}

export function DocumentsPanel() {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const withToken = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
    }
    return token;
  }, [getToken]);

  const refresh = useCallback(async () => {
    const token = await withToken();
    setDocuments(await listDocuments(token));
  }, [withToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const token = await withToken();
        const rows = await listDocuments(token);
        if (!cancelled) setDocuments(rows);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Không tải được tài liệu.");
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

  const hasWorkInProgress = documents.some(isBusy);

  useEffect(() => {
    if (!hasWorkInProgress) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => {
        // keep the last list if a poll fails
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hasWorkInProgress, refresh]);

  async function onUpload(files: File[]) {
    const accepted: File[] = [];
    for (const file of files) {
      const extension = extensionOf(file.name);
      if (!ALLOWED.includes(extension)) {
        toast.error(`${file.name}: chỉ hỗ trợ PDF, DOCX, PPTX, TXT và Markdown.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: file vượt quá 15 MB.`);
        continue;
      }
      if (file.size === 0) {
        toast.error(`${file.name}: file trống.`);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) return;

    setUploading(true);
    try {
      const token = await withToken();
      for (const file of accepted) {
        const created = await uploadDocument(token, file);
        setDocuments((current) => [
          created,
          ...current.filter((item) => item.id !== created.id),
        ]);
        toast.success(`Đã tải ${created.filename}. Đang embed.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không tải được tài liệu.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onEmbed(documentId: string) {
    setBusyId(documentId);
    setConfirmDeleteId(null);
    try {
      const token = await withToken();
      const updated = await embedDocument(token, documentId);
      setDocuments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success("Đã đưa tài liệu vào hàng đợi embed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không embed được tài liệu.");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(documentId: string) {
    setBusyId(documentId);
    try {
      const token = await withToken();
      await deleteDocument(token, documentId);
      setDocuments((current) => current.filter((item) => item.id !== documentId));
      setConfirmDeleteId(null);
      toast.success("Đã xóa tài liệu.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không xóa được tài liệu.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-black/10 px-6 py-4 dark:border-white/10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tài liệu</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Tải PDF, Word, PowerPoint, TXT hoặc Markdown. File được embed để Trợ lý Sales đọc.
          </p>
        </div>
        <div className="shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.pptx,.txt,.md,application/pdf,text/plain,text/markdown"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = event.target.files ? [...event.target.files] : [];
              if (files.length) void onUpload(files);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-10 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {uploading ? "Đang tải..." : "Tải tài liệu"}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        {loading ? (
          <p className="text-sm text-black/60 dark:text-white/60">Đang tải danh sách...</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">
            Chưa có tài liệu. Mỗi file tối đa 15 MB.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {documents.map((document) => {
              const working = isBusy(document) || busyId === document.id;
              return (
                <li
                  key={document.id}
                  className="rounded-xl border border-black/10 p-4 dark:border-white/10"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{document.filename}</p>
                      <p className="mt-1 text-xs text-black/55 dark:text-white/55">
                        {formatSize(document.byte_size)}
                        {document.created_at ? ` · ${formatWhen(document.created_at)}` : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(document.status)}`}
                    >
                      {statusText(document)}
                    </span>
                  </div>
                  {document.error ? (
                    <p className="mt-2 text-sm text-red-700 dark:text-red-300">{document.error}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onEmbed(document.id)}
                      disabled={working || uploading}
                      className="h-9 rounded-lg border border-black/15 px-3 text-sm disabled:opacity-50 dark:border-white/20"
                    >
                      {isBusy(document) ? "Đang embed..." : document.status === "ready" ? "Embed lại" : "Embed"}
                    </button>
                    {confirmDeleteId === document.id ? (
                      <>
                        <span className="text-sm text-black/70 dark:text-white/70">
                          Xóa tài liệu này?
                        </span>
                        <button
                          type="button"
                          onClick={() => void onDelete(document.id)}
                          disabled={busyId === document.id}
                          className="h-9 rounded-lg bg-red-700 px-3 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="h-9 rounded-lg border border-black/15 px-3 text-sm dark:border-white/20"
                        >
                          Hủy
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(document.id)}
                        disabled={busyId === document.id || uploading}
                        className="h-9 rounded-lg border border-black/15 px-3 text-sm disabled:opacity-50 dark:border-white/20"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
