import { DebtsPanel } from "@/components/DebtsPanel";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DebtsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <DebtsPanel />;
}
