import { redirect } from "next/navigation"

import { AccountProfileClient } from "@/components/account/account-profile-client"
import { getServerAuthSession } from "@/lib/auth/server"

export default async function AccountProfilePage() {
  const session = await getServerAuthSession()
  if (!session?.user?.id) redirect("/")

  const roleLabel =
    session.user.role === "admin"
      ? "Admin"
      : session.user.role === "petugas_plp"
        ? "Petugas PLP"
        : session.user.role === "dosen"
          ? "Dosen"
        : "Mahasiswa"

  return (
    <AccountProfileClient
      initialFullName={session.user.name ?? ""}
      initialEmail={session.user.email ?? ""}
      username={session.user.username ?? "-"}
      roleLabel={roleLabel}
    />
  )
}
