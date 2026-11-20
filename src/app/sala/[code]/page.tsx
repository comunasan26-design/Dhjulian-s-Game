import { redirect } from "next/navigation";
import { RoomClient } from "@/components/room/RoomClient";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  const { code } = await params;
  if (!user) redirect("/");
  return <RoomClient code={code.toUpperCase()} meId={user.id} />;
}
