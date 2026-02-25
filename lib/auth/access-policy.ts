export type AppRole = "admin" | "mahasiswa" | "petugas_plp"

type DashboardRedirectInput = {
  role?: AppRole | null
  pathname: string
  mustChangePassword?: boolean | null
}

export function getDashboardAccessRedirect(input: DashboardRedirectInput): string | null {
  const { role, pathname, mustChangePassword } = input

  if (mustChangePassword) {
    if (pathname !== "/dashboard/account/security") {
      return "/dashboard/account/security"
    }
    return null
  }

  if (role === "mahasiswa") {
    if (pathname === "/dashboard") return "/dashboard/student-tools"
    if (pathname !== "/dashboard/student-tools" && pathname !== "/dashboard/account/security") {
      return "/dashboard/student-tools"
    }
  }

  return null
}

export function canAccessLabByAssignment(input: {
  role?: AppRole | null
  labId: string
  assignedLabIds?: string[]
}) {
  if (input.role === "admin") return true
  if (input.role === "petugas_plp") return (input.assignedLabIds ?? []).includes(input.labId)
  return false
}

