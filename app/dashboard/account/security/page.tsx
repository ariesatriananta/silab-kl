import { redirect } from "next/navigation"

import { getServerAuthSession } from "@/lib/auth/server"
import { AccountSecurityClient } from "@/components/account/account-security-client"

export default async function AccountSecurityPage() {
  const session = await getServerAuthSession()
  if (!session?.user?.id) redirect("/")

  return (
    <AccountSecurityClient
      mustChangePassword={Boolean(session.user.mustChangePassword)}
      displayName={session.user.name ?? session.user.username ?? "Pengguna"}
    />
  )
}
