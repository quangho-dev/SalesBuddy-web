import { CustomersPanel } from "@/components/CustomersPanel";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function CustomersPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <CustomersPanel />;
}
