import { ProductsPanel } from "@/components/ProductsPanel";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ProductsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <ProductsPanel />;
}
