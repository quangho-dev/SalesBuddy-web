import { QuotesPanel } from "@/components/QuotesPanel";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function QuotesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <QuotesPanel />;
}
