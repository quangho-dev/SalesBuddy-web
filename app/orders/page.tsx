import { OrdersPanel } from "@/components/OrdersPanel";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OrdersPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <OrdersPanel />;
}
