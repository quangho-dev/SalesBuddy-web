import { SearchTargetCustomers } from "@/components/SearchTargetCustomers";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
          <p className="text-sm text-black/60 dark:text-white/60">Đang tải...</p>
        </main>
      }
    >
      <SearchTargetCustomers />
    </Suspense>
  );
}
