import { ChatPanel } from "@/components/ChatPanel";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Trợ lý Sales",
};

export default async function ChatPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <ChatPanel />;
}
