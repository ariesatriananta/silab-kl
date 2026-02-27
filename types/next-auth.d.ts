import type { DefaultSession } from "next-auth"
import type { JWT as DefaultJWT } from "next-auth/jwt"

type AppRole = "admin" | "mahasiswa" | "petugas_plp" | "dosen"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      role: AppRole
      username?: string
      mustChangePassword?: boolean
    }
  }

  interface User {
    role: AppRole
    username?: string
    mustChangePassword?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: AppRole
    username?: string
    mustChangePassword?: boolean
  }
}
