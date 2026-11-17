import { StaffPanel } from "@/components/StaffPanel";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function StaffPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <StaffPanel />;
}
