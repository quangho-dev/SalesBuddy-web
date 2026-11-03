"use client";

import { useAuth } from "@clerk/nextjs";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getRagSettings,
  getSettings,
  RagSettings,
  RagStrategy,
  updateRagSettings,
  updateSettings,
} from "@/lib/api";

const inputClass =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 disabled:opacity-60 dark:border-white/20 dark:focus:border-white/50";

const FALLBACK_DAYS = "3";

const RAG_STRATEGY_OPTIONS: { value: RagStrategy; label: string; hint: string }[] = [
  {
    value: "basic",
    label: "Tìm theo nghĩa",
    hint: "Chỉ so độ gần nghĩa giữa câu hỏi và các đoạn tài liệu.",
  },
  {
    value: "hybrid",
    label: "Kết hợp nghĩa và từ khóa",
    hint: "Vừa tìm theo nghĩa, vừa tìm đúng từ trong tài liệu.",
  },
  {
    value: "multi-query-vector",
    label: "Nhiều cách hỏi, tìm theo nghĩa",
    hint: "Đặt lại câu hỏi theo vài cách, rồi tìm theo nghĩa.",
  },
  {
    value: "multi-query-hybrid",
    label: "Nhiều cách hỏi, kết hợp nghĩa và từ khóa",
    hint: "Đặt lại câu hỏi theo vài cách, rồi tìm cả nghĩa lẫn từ khóa.",
  },
];

const FALLBACK_RAG: RagSettings = {
  rag_strategy: "hybrid",
  final_context_size: 8,
  similarity_threshold: 0.25,
  chunks_per_search: 8,
  vector_weight: 0.7,
  keyword_weight: 0.3,
  number_of_queries: 3,
};

function usesKeywordWeight(strategy: RagStrategy) {
  return strategy === "hybrid" || strategy === "multi-query-hybrid";
}

function usesQueryCount(strategy: RagStrategy) {
  return strategy === "multi-query-vector" || strategy === "multi-query-hybrid";
}

export function SettingsPanel() {
  const { getToken } = useAuth();
  const [days, setDays] = useState(FALLBACK_DAYS);
  const [rag, setRag] = useState<RagSettings>(FALLBACK_RAG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRag, setSavingRag] = useState(false);

  const withToken = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("Không lấy được phiên đăng nhập. Hãy đăng nhập lại.");
    }
    return token;
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const token = await withToken();
        const [settings, ragSettings] = await Promise.all([
          getSettings(token),
          getRagSettings(token),
        ]);
        if (!cancelled) {
          setDays(String(settings.default_payment_term_days ?? 3));
          setRag(ragSettings);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Không tải được cài đặt.",
          );
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

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(days);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Hạn công nợ phải là số ngày từ 0 trở lên.");
      return;
    }
    const nextDays = Math.round(parsed);
    setSaving(true);
    try {
      const token = await withToken();
      const saved = await updateSettings(token, {
        default_payment_term_days: nextDays,
      });
      setDays(String(saved.default_payment_term_days));
      toast.success("Đã lưu hạn công nợ mặc định.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được cài đặt.");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveRag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const finalContextSize = Math.round(rag.final_context_size);
    const chunksPerSearch = Math.round(rag.chunks_per_search);
    const queryCount = Math.round(rag.number_of_queries);
    if (
      finalContextSize < 1 ||
      finalContextSize > 30 ||
      chunksPerSearch < 1 ||
      chunksPerSearch > 30 ||
      rag.similarity_threshold < 0 ||
      rag.similarity_threshold > 1 ||
      rag.vector_weight < 0 ||
      rag.vector_weight > 1 ||
      rag.keyword_weight < 0 ||
      rag.keyword_weight > 1 ||
      queryCount < 1 ||
      queryCount > 6
    ) {
      toast.error("Một số giá trị tìm kiếm tài liệu nằm ngoài khoảng cho phép.");
      return;
    }
    const payload: RagSettings = {
      ...rag,
      final_context_size: finalContextSize,
      chunks_per_search: chunksPerSearch,
      number_of_queries: queryCount,
    };
    setSavingRag(true);
    try {
      const token = await withToken();
      setRag(await updateRagSettings(token, payload));
      toast.success("Đã lưu cách tìm kiếm tài liệu.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không lưu được cài đặt RAG.");
    } finally {
      setSavingRag(false);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-black/10 px-6 py-4 dark:border-white/10">
        <h1 className="text-lg font-semibold tracking-tight">Cài đặt</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Hạn công nợ cho khách hàng mới và cách tìm trong tài liệu.
        </p>
      </header>

      <div className="flex max-w-xl flex-col gap-8 p-6">
      <form onSubmit={(event) => void onSave(event)}>
        <label className="flex flex-col gap-1 text-sm" htmlFor="default-payment-term">
          Hạn công nợ mặc định (ngày)
          <input
            id="default-payment-term"
            type="number"
            min="0"
            step="1"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className={inputClass}
            disabled={loading || saving}
          />
        </label>
        <p className="mt-2 text-xs text-black/55 dark:text-white/55">
          Số ngày mỗi khách hàng mới được nợ, tính từ ngày tạo đơn. Giá trị ban đầu là 3 ngày.
          Có thể đổi riêng trên từng khách hàng.
        </p>
        <button
          type="submit"
          disabled={loading || saving}
          className="mt-4 h-10 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
      </form>

      <form
        onSubmit={(event) => void onSaveRag(event)}
        className="border-t border-black/10 pt-8 dark:border-white/10"
      >
        <h2 className="text-base font-semibold">Tìm kiếm tài liệu</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Áp dụng khi Trợ lý Sales trả lời từ các tài liệu đã tải.
        </p>

        <label className="mt-4 flex flex-col gap-1 text-sm" htmlFor="rag-strategy">
          Cách tìm
          <select
            id="rag-strategy"
            value={rag.rag_strategy}
            onChange={(event) =>
              setRag((current) => ({
                ...current,
                rag_strategy: event.target.value as RagStrategy,
              }))
            }
            className={inputClass}
            disabled={loading || savingRag}
          >
            {RAG_STRATEGY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-black/55 dark:text-white/55">
          {RAG_STRATEGY_OPTIONS.find((option) => option.value === rag.rag_strategy)?.hint}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm" htmlFor="final-context-size">
            Số đoạn đưa vào câu trả lời
            <input
              id="final-context-size"
              type="number"
              min="1"
              max="30"
              step="1"
              value={rag.final_context_size}
              onChange={(event) =>
                setRag((current) => ({
                  ...current,
                  final_context_size: Number(event.target.value),
                }))
              }
              className={inputClass}
              disabled={loading || savingRag}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm" htmlFor="chunks-per-search">
            Số đoạn mỗi lần tìm
            <input
              id="chunks-per-search"
              type="number"
              min="1"
              max="30"
              step="1"
              value={rag.chunks_per_search}
              onChange={(event) =>
                setRag((current) => ({
                  ...current,
                  chunks_per_search: Number(event.target.value),
                }))
              }
              className={inputClass}
              disabled={loading || savingRag}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm" htmlFor="similarity-threshold">
            Ngưỡng độ giống
            <input
              id="similarity-threshold"
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={rag.similarity_threshold}
              onChange={(event) =>
                setRag((current) => ({
                  ...current,
                  similarity_threshold: Number(event.target.value),
                }))
              }
              className={inputClass}
              disabled={loading || savingRag}
            />
          </label>
          {usesQueryCount(rag.rag_strategy) ? (
            <label className="flex flex-col gap-1 text-sm" htmlFor="number-of-queries">
              Số cách diễn đạt câu hỏi
              <input
                id="number-of-queries"
                type="number"
                min="1"
                max="6"
                step="1"
                value={rag.number_of_queries}
                onChange={(event) =>
                  setRag((current) => ({
                    ...current,
                    number_of_queries: Number(event.target.value),
                  }))
                }
                className={inputClass}
                disabled={loading || savingRag}
              />
            </label>
          ) : null}
          {usesKeywordWeight(rag.rag_strategy) ? (
            <>
              <label className="flex flex-col gap-1 text-sm" htmlFor="vector-weight">
                Trọng số tìm theo nghĩa
                <input
                  id="vector-weight"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={rag.vector_weight}
                  onChange={(event) =>
                    setRag((current) => ({
                      ...current,
                      vector_weight: Number(event.target.value),
                    }))
                  }
                  className={inputClass}
                  disabled={loading || savingRag}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm" htmlFor="keyword-weight">
                Trọng số tìm theo từ khóa
                <input
                  id="keyword-weight"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={rag.keyword_weight}
                  onChange={(event) =>
                    setRag((current) => ({
                      ...current,
                      keyword_weight: Number(event.target.value),
                    }))
                  }
                  className={inputClass}
                  disabled={loading || savingRag}
                />
              </label>
            </>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-black/55 dark:text-white/55">
          Đoạn có độ giống thấp hơn ngưỡng sẽ bị bỏ khi tìm theo nghĩa. Ngưỡng càng cao thì kết quả càng chặt.
        </p>
        <button
          type="submit"
          disabled={loading || savingRag}
          className="mt-4 h-10 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {savingRag ? "Đang lưu..." : "Lưu tìm kiếm tài liệu"}
        </button>
      </form>
      </div>
    </main>
  );
}
