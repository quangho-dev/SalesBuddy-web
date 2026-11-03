import { DocumentsPanel } from "@/components/DocumentsPanel";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DocumentsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <DocumentsPanel />;
}
