import { redirect } from "next/navigation";
import { LobbyClient } from "@/components/LobbyClient";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LobbyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return <LobbyClient username={user.username} />;
}
