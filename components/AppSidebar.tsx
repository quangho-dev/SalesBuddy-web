"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import {
  createTargetCustomerList,
  fetchTargetCustomerLists,
  type TargetCustomerList,
} from "@/lib/api";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type AppSidebarProps = {
  onNavigate?: () => void;
};

function navItemClass(active: boolean) {
  return [
    "block rounded-lg px-3 py-2 text-sm",
    active
      ? "bg-black text-white dark:bg-white dark:text-black"
      : "text-black/80 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10",
  ].join(" ");
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const { getToken } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedListId = searchParams.get("listId");

  const [lists, setLists] = useState<TargetCustomerList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Không lấy được phiên đăng nhập.");
      setLists(await fetchTargetCustomerLists(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách.");
    } finally {
      setLoadingLists(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  async function onCreateList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;

    setCreating(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Không lấy được phiên đăng nhập.");
      const created = await createTargetCustomerList(token, name);
      setLists((current) => [created, ...current]);
      setNewName("");
      setShowCreate(false);
      onNavigate?.();
      router.push(`/?listId=${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được danh sách.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-black/10 bg-black/2 dark:border-white/10 dark:bg-white/3">
      <div className="border-b border-black/10 px-4 py-4 dark:border-white/10">
        <Link
          href="/"
          onClick={onNavigate}
          className="text-sm font-semibold tracking-tight"
        >
          Sales Buddy
        </Link>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className={navItemClass(pathname === "/" && !selectedListId)}
        >
          Tìm kiếm
        </Link>
        <Link
          href="/chat"
          onClick={onNavigate}
          className={navItemClass(pathname === "/chat")}
        >
          Chat
        </Link>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
            Danh sách
          </p>
          <button
            type="button"
            onClick={() => setShowCreate((open) => !open)}
            className="rounded-md px-2 py-1 text-xs text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10"
          >
            {showCreate ? "Hủy" : "Tạo mới"}
          </button>
        </div>

        {showCreate ? (
          <form onSubmit={onCreateList} className="mb-3 flex flex-col gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Tên danh sách"
              className="rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
              disabled={creating}
              autoFocus
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="rounded-md bg-black px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {creating ? "Đang tạo..." : "Tạo danh sách"}
            </button>
          </form>
        ) : null}

        {error ? (
          <p className="mb-2 px-1 text-xs text-red-700 dark:text-red-300">{error}</p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingLists ? (
            <p className="px-3 py-2 text-xs text-black/50 dark:text-white/50">
              Đang tải...
            </p>
          ) : lists.length === 0 ? (
            <p className="px-3 py-2 text-xs text-black/50 dark:text-white/50">
              Chưa có danh sách. Tạo mới để bắt đầu tìm kiếm.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {lists.map((list) => (
                <li key={list.id}>
                  <Link
                    href={`/?listId=${list.id}`}
                    onClick={onNavigate}
                    className={navItemClass(
                      pathname === "/" && selectedListId === list.id,
                    )}
                    title={list.description}
                  >
                    <span className="line-clamp-2">{list.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
        <UserButton />
      </div>
    </aside>
  );
}
