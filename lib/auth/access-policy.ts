export type AppRole = "admin" | "mahasiswa" | "petugas_plp" | "dosen"

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
    if (pathname === "/dashboard") return "/dashboard/borrowing"
    const mahasiswaAllowedPaths = new Set([
      "/dashboard/student-tools",
      "/dashboard/student-lab-schedule",
      "/dashboard/borrowing",
      "/dashboard/account/profile",
      "/dashboard/account/security",
    ])
    if (!mahasiswaAllowedPaths.has(pathname)) {
      return "/dashboard/borrowing"
    }
  }

  if (role === "dosen") {
    if (pathname === "/dashboard") return "/dashboard/borrowing"
    const dosenAllowedPaths = new Set([
      "/dashboard/borrowing",
      "/dashboard/account/profile",
      "/dashboard/account/security",
    ])
    if (!dosenAllowedPaths.has(pathname)) {
      return "/dashboard/borrowing"
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
  if (input.role === "petugas_plp" || input.role === "dosen") {
    return (input.assignedLabIds ?? []).includes(input.labId)
  }
  return false
}
