import { QuotesPanel } from "@/components/QuotesPanel";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  return <QuotesPanel initialQuoteId={params.id} />;
}
