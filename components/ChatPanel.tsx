"use client";

import { useAuth } from "@clerk/nextjs";
import { ChevronRight, Files, Globe, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import {
  ChatThread,
  DocumentCitation,
  SalesDocument,
  connectGoogleSheets,
  getGoogleSheetsStatus,
  deleteChatThread,
  listChatMessages,
  listChatThreads,
  listDocuments,
  renameChatThread,
  sendChatMessage,
} from "@/lib/api";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  pending?: boolean;
  status?: string;
  citations?: DocumentCitation[];
};

function citationsFrom(value: unknown): DocumentCitation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as DocumentCitation;
    const excerpt = String(row.excerpt || "").trim();
    const filename = String(row.filename || "").trim();
    if (!excerpt || !filename) return [];
    return [{ filename, excerpt, page: row.page }];
  });
}

function citationTitle(item: DocumentCitation) {
  if (item.page != null && item.page !== "") {
    return `${item.filename} · trang ${item.page}`;
  }
  return item.filename;
}

function CitationList({ items }: { items: DocumentCitation[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  if (items.length === 0) return null;
  return (
    <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/15">
      <p className="text-xs font-medium text-black/55 dark:text-white/55">Trích dẫn</p>
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((item, index) => {
          const expanded = Boolean(open[index]);
          return (
            <li key={`${item.filename}-${item.page ?? "x"}-${index}`}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() =>
                  setOpen((current) => ({ ...current, [index]: !current[index] }))
                }
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10"
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{citationTitle(item)}</span>
              </button>
              {expanded ? (
                <p className="whitespace-pre-wrap px-7 pb-2 text-sm text-black/80 dark:text-white/80">
                  {item.excerpt}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function nextId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sheetsLoginNeeded(text: string) {
  const value = text.toLowerCase();
  return (
    value.includes("không tra được google sheets") ||
    value.includes("invalid_grant") ||
    value.includes("token has been expired") ||
    value.includes("authentication methods failed")
  );
}

function formatThreadTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function documentStatusLabel(status: string) {
  if (status === "ready") return "Sẵn sàng";
  if (status === "failed") return "Lỗi";
  return "Đang embed";
}

function DocumentPicker({
  documents,
  selectedIds,
  open,
  disabled,
  onToggleOpen,
  onToggleDocument,
  onClear,
}: {
  documents: SalesDocument[];
  selectedIds: string[];
  open: boolean;
  disabled: boolean;
  onToggleOpen: () => void;
  onToggleDocument: (documentId: string) => void;
  onClear: () => void;
}) {
  const readyCount = documents.filter((document) => document.status === "ready").length;
  const selected = documents.filter((document) => selectedIds.includes(document.id));
  const label =
    selected.length === 0 ? "Tất cả tài liệu" : `${selected.length} tài liệu`;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleOpen}
          disabled={disabled}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-black/15 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20"
        >
          <Files className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          {label}
        </button>
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="h-9 rounded-lg px-2 text-sm text-black/60 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/60"
          >
            Bỏ chọn
          </button>
        ) : null}
      </div>
      {selected.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((document) => (
            <li key={document.id}>
              <button
                type="button"
                onClick={() => onToggleDocument(document.id)}
                disabled={disabled}
                className="max-w-full truncate rounded-full border border-black/15 px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20"
                title="Bỏ tài liệu này"
              >
                {document.filename}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-black/45 dark:text-white/45">
          Chưa chọn thì câu hỏi tìm trong mọi tài liệu đã sẵn sàng.
        </p>
      )}
      {open ? (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-full max-w-md rounded-xl border border-black/10 bg-white p-3 shadow-lg dark:border-white/15 dark:bg-black">
          <p className="text-sm font-medium">Chọn tài liệu để hỏi</p>
          {documents.length === 0 ? (
            <p className="mt-2 text-sm text-black/60 dark:text-white/60">
              Chưa có tài liệu.{" "}
              <Link href="/documents" className="underline">
                Tải tài liệu
              </Link>
            </p>
          ) : (
            <ul className="mt-2 max-h-56 overflow-y-auto">
              {documents.map((document) => {
                const ready = document.status === "ready";
                return (
                  <li key={document.id}>
                    <label
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                        ready ? "hover:bg-black/5 dark:hover:bg-white/10" : "opacity-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(document.id)}
                        disabled={!ready || disabled}
                        onChange={() => onToggleDocument(document.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{document.filename}</span>
                      {ready ? null : (
                        <span className="shrink-0 text-xs">{documentStatusLabel(document.status)}</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {documents.length > 0 && readyCount === 0 ? (
            <p className="mt-2 text-xs text-black/50 dark:text-white/50">
              Chưa có tài liệu nào embed xong.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ThreadList({
  threads,
  activeThreadId,
  disabled,
  onCreate,
  onSelect,
  onRename,
  onDelete,
}: {
  threads: ChatThread[];
  activeThreadId: string | null;
  disabled: boolean;
  onCreate: () => void;
  onSelect: (threadId: string) => void;
  onRename: (threadId: string, title: string) => Promise<void>;
  onDelete: (threadId: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [savingTitle, setSavingTitle] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startRename(thread: ChatThread) {
    setConfirmDeleteId(null);
    setEditingId(thread.id);
    setDraft(thread.title);
    setRenameError(null);
  }

  async function removeThread(threadId: string) {
    setDeletingId(threadId);
    setRenameError(null);
    try {
      await onDelete(threadId);
      setConfirmDeleteId(null);
      if (editingId === threadId) cancelRename();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Không xóa được cuộc trò chuyện.");
    } finally {
      setDeletingId(null);
    }
  }

  function cancelRename() {
    setEditingId(null);
    setDraft("");
    setRenameError(null);
  }

  async function saveRename(threadId: string) {
    const title = draft.trim();
    if (!title) {
      setRenameError("Hãy nhập tiêu đề.");
      return;
    }
    setSavingTitle(true);
    setRenameError(null);
    try {
      await onRename(threadId, title);
      setEditingId(null);
      setDraft("");
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Không đổi được tiêu đề.");
    } finally {
      setSavingTitle(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-black/10 px-3 py-3 dark:border-white/10">
        <button
          type="button"
          onClick={onCreate}
          disabled={disabled}
          className="h-10 w-full rounded-lg border border-black/15 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20"
        >
          Cuộc trò chuyện mới
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {threads.length === 0 ? (
          <p className="px-2 py-3 text-sm text-black/50 dark:text-white/50">
            Chưa có cuộc trò chuyện.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {threads.map((thread) => {
              const selected = thread.id === activeThreadId;
              return (
                <li key={thread.id}>
                  <div
                    className={
                      selected
                        ? "rounded-lg bg-primary px-3 py-2 text-white dark:bg-primary dark:text-white"
                        : "rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                    }
                  >
                    {editingId === thread.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveRename(thread.id);
                        }}
                      >
                        <input
                          value={draft}
                          autoFocus
                          disabled={savingTitle}
                          aria-label="Tiêu đề cuộc trò chuyện"
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") cancelRename();
                          }}
                          className="w-full rounded-md border border-black/15 bg-white px-2 py-1 text-sm text-black outline-none focus:border-primary dark:border-white/20 dark:bg-navy dark:text-white"
                        />
                        {renameError ? (
                          <p
                            className={
                              selected
                                ? "mt-1 text-xs text-red-100"
                                : "mt-1 text-xs text-red-700 dark:text-red-300"
                            }
                          >
                            {renameError}
                          </p>
                        ) : (
                          <p
                            className={
                              selected
                                ? "mt-1 text-xs text-white/70"
                                : "mt-1 text-xs text-black/45 dark:text-white/45"
                            }
                          >
                            Enter để lưu, Esc để hủy
                          </p>
                        )}
                      </form>
                    ) : (
                      <div className="flex items-start gap-1">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => onSelect(thread.id)}
                          className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                        >
                          <span className="block whitespace-normal break-words text-sm font-medium">
                            {thread.title}
                          </span>
                          <span
                            className={
                              selected
                                ? "mt-0.5 block text-xs text-white/70"
                                : "mt-0.5 block text-xs text-black/45 dark:text-white/45"
                            }
                          >
                            {formatThreadTime(thread.updated_at)}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center">
                          {confirmDeleteId === thread.id ? (
                            <>
                              <button
                                type="button"
                                disabled={deletingId === thread.id}
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-md px-1.5 py-1 text-xs disabled:opacity-50"
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === thread.id}
                                onClick={() => void removeThread(thread.id)}
                                className={
                                  selected
                                    ? "rounded-md px-1.5 py-1 text-xs font-medium text-red-100 disabled:opacity-50"
                                    : "rounded-md px-1.5 py-1 text-xs font-medium text-red-700 disabled:opacity-50 dark:text-red-200"
                                }
                              >
                                {deletingId === thread.id ? "..." : "Xóa"}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={disabled || savingTitle}
                                aria-label={`Đổi tiêu đề ${thread.title}`}
                                title="Đổi tiêu đề"
                                onClick={() => startRename(thread)}
                                className={
                                  selected
                                    ? "rounded-md p-1 text-white/80 hover:bg-white/15 disabled:opacity-50"
                                    : "rounded-md p-1 text-black/45 hover:bg-black/5 disabled:opacity-50 dark:text-white/50 dark:hover:bg-white/10"
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
                              <button
                                type="button"
                                disabled={disabled || deletingId !== null}
                                aria-label={`Xóa ${thread.title}`}
                                title="Xóa cuộc trò chuyện"
                                onClick={() => {
                                  cancelRename();
                                  setConfirmDeleteId(thread.id);
                                }}
                                className={
                                  selected
                                    ? "rounded-md p-1 text-white/80 hover:bg-white/15 disabled:opacity-50"
                                    : "rounded-md p-1 text-black/45 hover:bg-black/5 disabled:opacity-50 dark:text-white/50 dark:hover:bg-white/10"
                                }
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const { getToken } = useAuth();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheetsConnected, setSheetsConnected] = useState<boolean | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [documents, setDocuments] = useState<SalesDocument[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeThreadRef = useRef<string | null>(null);

  useEffect(() => {
    activeThreadRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function rememberThread(thread: ChatThread) {
    setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
    setActiveThreadId(thread.id);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSheetsStatus() {
      const params = new URLSearchParams(window.location.search);
      const google = params.get("google");
      if (google) {
        window.history.replaceState({}, "", "/chat");
        if (google === "connected") {
          setNotice("Đã đăng nhập Google Sheets.");
          setSheetsConnected(true);
        } else {
          setError("Không đăng nhập được Google Sheets. Hãy thử lại.");
          setSheetsConnected(false);
        }
      }

      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const status = await getGoogleSheetsStatus(token);
        if (!cancelled) setSheetsConnected(status.connected);
      } catch {
        if (!cancelled && google !== "connected") setSheetsConnected(null);
      }
    }

    async function loadHistory() {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const savedThreads = await listChatThreads(token);
        if (cancelled) return;
        setThreads(savedThreads);
        const latest = savedThreads[0];
        if (!latest) return;
        const history = await listChatMessages(token, latest.id);
        if (cancelled) return;
        setActiveThreadId(latest.id);
        setMessages((current) => {
          if (current.length > 0) return current;
          return history.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            citations: citationsFrom(message.citations),
          }));
        });
      } catch {
        if (!cancelled) {
          setError("Không tải được lịch sử tin nhắn.");
        }
      } finally {
        if (!cancelled) setHistoryReady(true);
      }
    }

    async function loadDocuments() {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const rows = await listDocuments(token);
        if (!cancelled) setDocuments(rows);
      } catch {
        if (!cancelled) setDocuments([]);
      } finally {
        if (!cancelled) setDocumentsLoaded(true);
      }
    }

    void loadSheetsStatus();
    void loadHistory();
    void loadDocuments();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    if (!documentsLoaded) return;
    const readyIds = new Set(
      documents.filter((document) => document.status === "ready").map((document) => document.id),
    );
    setSelectedDocumentIds((current) => current.filter((id) => readyIds.has(id)));
  }, [documents, documentsLoaded]);

  async function openThread(threadId: string) {
    if (loading || threadId === activeThreadId) {
      setHistoryOpen(false);
      return;
    }
    setError(null);
    setHistoryOpen(false);
    setActiveThreadId(threadId);
    setMessages([]);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
      }
      const history = await listChatMessages(token, threadId);
      setMessages(
        history.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          citations: citationsFrom(message.citations),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được cuộc trò chuyện.");
    }
  }

  function startNewConversation() {
    if (loading) return;
    setActiveThreadId(null);
    setMessages([]);
    setInput("");
    setError(null);
    setHistoryOpen(false);
  }

  async function connectSheets() {
    setConnecting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
      }
      window.location.assign(await connectGoogleSheets(token));
    } catch (err) {
      setConnecting(false);
      setError(err instanceof Error ? err.message : "Không mở được trang đăng nhập Google.");
    }
  }

  async function sendPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (trimmed.length < 2 || loading) return;

    const assistantId = nextId();
    const startedThreadId = activeThreadRef.current;
    let createdThreadId: string | null = null;
    let reply = "";
    setInput("");
    setError(null);
    setPickerOpen(false);
    setLoading(true);
    setMessages((current) => [
      ...current,
      { id: nextId(), role: "user", content: trimmed },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        pending: true,
        status: "Đang xử lý...",
      },
    ]);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
      }
      await sendChatMessage(
        trimmed,
        token,
        startedThreadId ?? "",
        (event) => {
          if (event.type === "thread" && event.id && event.title && event.updated_at) {
            if (!startedThreadId) createdThreadId = event.id;
            rememberThread({
              id: event.id,
              title: event.title,
              updated_at: event.updated_at,
            });
            return;
          }
          if (event.type === "status" && event.text) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, status: event.text } : message,
              ),
            );
            return;
          }
          if (event.type === "citations") {
            const items = citationsFrom(event.items);
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, citations: items } : message,
              ),
            );
            return;
          }
          if (event.type === "delta" && event.text) {
            reply += event.text;
            const nextReply = reply;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId ? { ...message, content: nextReply } : message,
              ),
            );
          }
        },
        selectedDocumentIds,
      );
      if (sheetsLoginNeeded(reply)) setSheetsConnected(false);
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                pending: false,
                content: reply || "Không có phản hồi.",
              }
            : message,
        ),
      );
      if (!reply && createdThreadId) {
        setThreads((current) => current.filter((thread) => thread.id !== createdThreadId));
        if (!startedThreadId) setActiveThreadId(null);
      }
    } catch (err) {
      if (createdThreadId) {
        setThreads((current) => current.filter((thread) => thread.id !== createdThreadId));
        setActiveThreadId(startedThreadId);
      }
      setError(err instanceof Error ? err.message : "Không gửi được tin nhắn.");
      setMessages((current) =>
        current.flatMap((message) => {
          if (message.id !== assistantId) return [message];
          if (!message.content.trim()) return [];
          return [{ ...message, pending: false }];
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteThread(threadId: string) {
    const token = await getToken();
    if (!token) throw new Error("Bạn cần đăng nhập lại.");
    await deleteChatThread(token, threadId);
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    if (activeThreadRef.current === threadId) {
      setActiveThreadId(null);
      setMessages([]);
      setInput("");
    }
  }

  async function renameThread(threadId: string, title: string) {
    const token = await getToken();
    if (!token) throw new Error("Bạn cần đăng nhập lại.");
    const updated = await renameChatThread(token, threadId, title);
    setThreads((current) =>
      current.map((thread) =>
        thread.id === updated.id ? { ...thread, title: updated.title } : thread,
      ),
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendPrompt(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt(input);
    }
  }

  const threadList = (
    <ThreadList
      threads={threads}
      activeThreadId={activeThreadId}
      disabled={loading || !historyReady}
      onCreate={startNewConversation}
      onSelect={(threadId) => void openThread(threadId)}
      onRename={renameThread}
      onDelete={deleteThread}
    />
  );

  return (
    <main className="relative flex min-h-0 flex-1">
      <aside className="hidden w-72 shrink-0 border-r border-black/10 md:flex md:min-h-0 md:flex-col dark:border-white/10">
        {threadList}
      </aside>
      {historyOpen ? (
        <div className="absolute inset-0 z-20 flex md:hidden">
          <div className="h-full w-72 max-w-[80%] bg-white dark:bg-black">{threadList}</div>
          <button
            type="button"
            aria-label="Đóng lịch sử"
            className="flex-1 bg-black/40"
            onClick={() => setHistoryOpen(false)}
          />
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="border-b border-black/10 px-6 py-4 dark:border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Trợ Lý Sales</h1>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                Hỏi về dữ liệu bán hàng, tài liệu đã tải, Google Sheets, hoặc tìm thông tin trên web.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="h-9 shrink-0 rounded-lg border border-black/15 px-3 text-sm md:hidden dark:border-white/20"
            >
              Lịch sử
            </button>
          </div>
          {sheetsConnected === false ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="min-w-0 flex-1">
                Google Sheets chưa đăng nhập hoặc token đã hết hạn. Dùng tài khoản Google đang chứa các bảng tính.
              </p>
              <button
                type="button"
                onClick={() => void connectSheets()}
                disabled={connecting}
                className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary dark:text-white"
              >
                {connecting ? "Đang mở Google..." : "Đăng nhập Google Sheets"}
              </button>
            </div>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
          {!historyReady ? (
            <p className="m-auto text-sm text-black/50 dark:text-white/50">Đang tải lịch sử...</p>
          ) : messages.length === 0 && !loading ? (
            <div className="m-auto max-w-lg text-center">
              <p className="text-sm text-black/55 dark:text-white/55">
                {activeThreadId
                  ? "Cuộc trò chuyện này chưa có tin nhắn."
                  : "Trợ Lý Sales trả lời từ các nguồn sau."}
              </p>
              {activeThreadId ? null : (
                <ul className="mt-4 flex flex-wrap justify-center gap-2">
                  {["Database bán hàng", "Tài liệu đã tải", "Google Sheets"].map((item) => (
                    <li
                      key={item}
                      className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium dark:border-white/20"
                    >
                      {item}
                    </li>
                  ))}
                  <li className="inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-primary px-3 py-1 text-xs font-medium text-white dark:border-white/20 dark:bg-primary dark:text-white">
                    <Globe className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                    Tìm trên web
                  </li>
                </ul>
              )}
              <p className="mt-4 text-sm text-black/55 dark:text-white/55">
                Ví dụ: “Khách nào còn công nợ?”, “Giá trong tài liệu đã tải là bao nhiêu?”, “Tìm giá inox trong bảng tính” hoặc “Giá thép hôm nay trên thị trường là bao nhiêu?”.
              </p>
            </div>
          ) : (
            <ul className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm text-white dark:bg-primary dark:text-white"
                      : "mr-auto max-w-[85%] rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/15"
                  }
                >
                  {message.role === "assistant" ? (
                    <>
                      {message.content ? (
                        <ChatMarkdown content={message.content} />
                      ) : (
                        <p className="text-black/50 dark:text-white/50">
                          {message.status || "Đang xử lý..."}
                        </p>
                      )}
                      <CitationList items={message.citations ?? []} />
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={onSubmit}
          className="border-t border-black/10 px-6 py-4 dark:border-white/10"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
            {notice ? (
              <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                {notice}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </p>
            ) : null}
            <DocumentPicker
              documents={documents}
              selectedIds={selectedDocumentIds}
              open={pickerOpen}
              disabled={loading || !historyReady}
              onToggleOpen={() => setPickerOpen((current) => !current)}
              onToggleDocument={(documentId) =>
                setSelectedDocumentIds((current) =>
                  current.includes(documentId)
                    ? current.filter((id) => id !== documentId)
                    : [...current, documentId],
                )
              }
              onClear={() => setSelectedDocumentIds([])}
            />
            <label htmlFor="chat-input" className="sr-only">
              Tin nhắn
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="chat-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter xuống dòng)"
                disabled={loading || !historyReady}
                className="min-h-[44px] w-full resize-none rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60 dark:border-white/20 dark:focus:border-primary"
              />
              <button
                type="submit"
                disabled={loading || !historyReady || input.trim().length < 2}
                className="h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary dark:text-white"
              >
                {loading ? "Đang gửi..." : "Gửi"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
