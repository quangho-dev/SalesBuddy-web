"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { sendChatMessage } from "@/lib/api";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

function nextId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatPanel() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const threadId = user?.id ?? "default";

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (trimmed.length < 2 || loading) return;

    setInput("");
    setError(null);
    setLoading(true);
    setMessages((current) => [
      ...current,
      { id: nextId(), role: "user", content: trimmed },
    ]);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
      }
      const reply = await sendChatMessage(trimmed, token, threadId);
      setMessages((current) => [
        ...current,
        { id: nextId(), role: "assistant", content: reply || "Không có phản hồi." },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được tin nhắn.");
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
        <h1 className="text-lg font-semibold tracking-tight">Chat</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Hỏi về Google Sheets: liệt kê file, đọc dữ liệu, hoặc tạo bảng tính mới.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
        {messages.length === 0 && !loading ? (
          <div className="m-auto max-w-md text-center text-sm text-black/55 dark:text-white/55">
            <p>Bắt đầu cuộc trò chuyện với trợ lý Google Sheets.</p>
            <p className="mt-2">
              Ví dụ: “Liệt kê các spreadsheet của tôi” hoặc “Tóm tắt dữ liệu trong
              sheet đầu tiên”.
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
                  <ChatMarkdown content={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
              </li>
            ))}
            {loading ? (
              <li className="mr-auto rounded-2xl border border-black/10 px-4 py-3 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
                Đang xử lý, có thể mất một vài phút...
              </li>
            ) : null}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="border-t border-black/10 px-6 py-4 dark:border-white/10"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
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
