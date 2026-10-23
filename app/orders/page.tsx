import { OrdersPanel } from "@/components/OrdersPanel";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  return <OrdersPanel initialOrderId={params.id} />;
}
