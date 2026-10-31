"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import {
  connectGoogleSheets,
  getGoogleSheetsStatus,
  sendChatMessage,
} from "@/lib/api";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  pending?: boolean;
  status?: string;
};

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

export function ChatPanel() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const threadId = user?.id ?? "default";

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheetsConnected, setSheetsConnected] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

    void loadSheetsStatus();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

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
    setInput("");
    setError(null);
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
      let reply = "";
      await sendChatMessage(trimmed, token, threadId, (event) => {
        if (event.type === "status" && event.text) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, status: event.text }
                : message,
            ),
          );
          return;
        }
        if (event.type === "delta" && event.text) {
          reply += event.text;
          const nextReply = reply;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: nextReply }
                : message,
            ),
          );
        }
      });
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
    } catch (err) {
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

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-black/10 px-6 py-4 dark:border-white/10">
        <h1 className="text-lg font-semibold tracking-tight">Trợ lý Sales</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Hỏi về dữ liệu bán hàng trong Supabase hoặc về Google Sheets.
        </p>
        {sheetsConnected === false ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="min-w-0 flex-1">
              Google Sheets chưa đăng nhập hoặc token đã hết hạn. Dùng tài khoản Google đang chứa các bảng tính.
            </p>
            <button
              type="button"
              onClick={() => void connectSheets()}
              disabled={connecting}
              className="h-9 shrink-0 rounded-lg bg-black px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {connecting ? "Đang mở Google..." : "Đăng nhập Google Sheets"}
            </button>
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
        {messages.length === 0 && !loading ? (
          <div className="m-auto max-w-md text-center text-sm text-black/55 dark:text-white/55">
            <p>Hỏi về database bán hàng hoặc về Google Sheets.</p>
            <p className="mt-2">
              Ví dụ: “Khách nào còn công nợ?” hoặc “Tìm giá inox trong bảng tính”.
            </p>
          </div>
        ) : (
          <ul className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {messages.map((message) => (
              <li
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-black px-4 py-3 text-sm text-white dark:bg-white dark:text-black"
                    : "mr-auto max-w-[85%] rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/15"
                }
              >
                {message.role === "assistant" ? (
                  message.content ? (
                    <ChatMarkdown content={message.content} />
                  ) : (
                    <p className="text-black/50 dark:text-white/50">
                      {message.status || "Đang xử lý..."}
                    </p>
                  )
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
              disabled={loading}
              className="min-h-[44px] w-full resize-none rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-60 dark:border-white/20 dark:focus:border-white/50"
            />
            <button
              type="submit"
              disabled={loading || input.trim().length < 2}
              className="h-11 shrink-0 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Đang gửi..." : "Gửi"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
