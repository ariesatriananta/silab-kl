import test from "node:test"
import assert from "node:assert/strict"

import { config as loadDotenv } from "dotenv"
import { eq, inArray } from "drizzle-orm"

import { canAccessLabByAssignment, getDashboardAccessRedirect } from "@/lib/auth/access-policy"
import { createDb } from "@/lib/db/create-db"
import { labs, userLabAssignments, users } from "@/lib/db/schema"

loadDotenv({ path: ".env.local" })
loadDotenv()

const db = createDb()

test("RBAC route guard: mahasiswa diarahkan ke student-tools kecuali halaman yang diizinkan", () => {
  assert.equal(
    getDashboardAccessRedirect({ role: "mahasiswa", pathname: "/dashboard", mustChangePassword: false }),
    "/dashboard/student-tools",
  )
  assert.equal(
    getDashboardAccessRedirect({
      role: "mahasiswa",
      pathname: "/dashboard/borrowing",
      mustChangePassword: false,
    }),
    "/dashboard/student-tools",
  )
  assert.equal(
    getDashboardAccessRedirect({
      role: "mahasiswa",
      pathname: "/dashboard/student-tools",
      mustChangePassword: false,
    }),
    null,
  )
  assert.equal(
    getDashboardAccessRedirect({
      role: "mahasiswa",
      pathname: "/dashboard/account/security",
      mustChangePassword: false,
    }),
    null,
  )
})

test("RBAC route guard: force change password override role redirect", () => {
  assert.equal(
    getDashboardAccessRedirect({
      role: "admin",
      pathname: "/dashboard/borrowing",
      mustChangePassword: true,
    }),
    "/dashboard/account/security",
  )
  assert.equal(
    getDashboardAccessRedirect({
      role: "mahasiswa",
      pathname: "/dashboard/student-tools",
      mustChangePassword: true,
    }),
    "/dashboard/account/security",
  )
  assert.equal(
    getDashboardAccessRedirect({
      role: "petugas_plp",
      pathname: "/dashboard/account/security",
      mustChangePassword: true,
    }),
    null,
  )
})

test("RBAC route guard: admin dan PLP tidak di-redirect pada halaman dashboard", () => {
  assert.equal(
    getDashboardAccessRedirect({ role: "admin", pathname: "/dashboard/borrowing", mustChangePassword: false }),
    null,
  )
  assert.equal(
    getDashboardAccessRedirect({
      role: "petugas_plp",
      pathname: "/dashboard/consumables",
      mustChangePassword: false,
    }),
    null,
  )
})

test("RBAC lab access: helper assignment mematuhi role admin/PLP/mahasiswa", async () => {
  const seedUsers = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users)
    .where(inArray(users.username, ["admin", "plp.suryani", "P27834021001"]))

  const admin = seedUsers.find((u) => u.username === "admin")
  const plp = seedUsers.find((u) => u.username === "plp.suryani")
  const mahasiswa = seedUsers.find((u) => u.username === "P27834021001")
  assert.ok(admin)
  assert.ok(plp)
  assert.ok(mahasiswa)

  const allLabs = await db.select({ id: labs.id }).from(labs).where(eq(labs.isActive, true))
  assert.ok(allLabs.length > 0)

  const plpAssignments = await db
    .select({ labId: userLabAssignments.labId })
    .from(userLabAssignments)
    .where(eq(userLabAssignments.userId, plp.id))
  const assignedLabIds = plpAssignments.map((a) => a.labId)
  assert.ok(assignedLabIds.length > 0)

  const assignedLabId = assignedLabIds[0]!
  const unassignedLabId = allLabs.map((l) => l.id).find((id) => !assignedLabIds.includes(id))
  assert.ok(unassignedLabId, "Perlu minimal 1 lab yang tidak diassign ke PLP seed")

  assert.equal(
    canAccessLabByAssignment({ role: "admin", labId: assignedLabId, assignedLabIds: [] }),
    true,
  )
  assert.equal(
    canAccessLabByAssignment({ role: "petugas_plp", labId: assignedLabId, assignedLabIds }),
    true,
  )
  assert.equal(
    canAccessLabByAssignment({ role: "petugas_plp", labId: unassignedLabId!, assignedLabIds }),
    false,
  )
  assert.equal(
    canAccessLabByAssignment({ role: "mahasiswa", labId: assignedLabId, assignedLabIds }),
    false,
  )
})

