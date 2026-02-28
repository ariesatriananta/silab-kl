import { config as loadDotenv } from "dotenv"
import { sql } from "drizzle-orm"

import { hashPassword } from "../lib/auth/password"
import { createDb } from "../lib/db/create-db"
import {
  borrowingApprovalMatrices,
  consumableItems,
  labs,
  toolAssets,
  toolModels,
  userLabAssignments,
  users,
} from "../lib/db/schema"

loadDotenv({ path: ".env.local" })
loadDotenv()

const db = createDb()

async function truncateAll() {
  await db.execute(sql`
    TRUNCATE TABLE
      borrowing_return_items,
      borrowing_returns,
      borrowing_handover_consumable_lines,
      borrowing_handovers,
      borrowing_approvals,
      borrowing_transaction_items,
      borrowing_transactions,
      borrowing_approval_matrix_steps,
      borrowing_approval_matrices,
      material_request_items,
      material_requests,
      lab_usage_logs,
      lab_schedules,
      tool_assets,
      tool_models,
      consumable_items,
      user_lab_assignments,
      labs,
      users
    RESTART IDENTITY CASCADE
  `)
}

async function main() {
  console.log("Seeding SILAB-KL master data...")

  await truncateAll()

  const defaultPasswordHash = await hashPassword("password")

  const insertedLabs = await db
    .insert(labs)
    .values([
      { code: "LAB-KIM", name: "Lab Kimia Klinik" },
      { code: "LAB-HEM", name: "Lab Hematologi" },
      { code: "LAB-MIK", name: "Lab Mikrobiologi" },
      { code: "LAB-PAR", name: "Lab Parasitologi" },
    ])
    .returning({ id: labs.id, code: labs.code, name: labs.name })

  const labByCode = Object.fromEntries(insertedLabs.map((lab) => [lab.code, lab]))

  const insertedUsers = await db
    .insert(users)
    .values([
      {
        username: "admin",
        fullName: "Admin Lab",
        email: "admin@silab-kl.local",
        role: "admin",
        passwordHash: defaultPasswordHash,
      },
      {
        username: "plp.suryani",
        nip: "198001012005012001",
        fullName: "Dr. Suryani",
        email: "suryani@silab-kl.local",
        role: "petugas_plp",
        passwordHash: defaultPasswordHash,
      },
      {
        username: "plp.hartono",
        nip: "197912102004121002",
        fullName: "Dr. Hartono",
        email: "hartono@silab-kl.local",
        role: "petugas_plp",
        passwordHash: defaultPasswordHash,
      },
      {
        username: "dosen.rahma",
        nip: "198511022012122001",
        fullName: "Dr. Rahmawati",
        email: "rahmawati@silab-kl.local",
        role: "dosen",
        passwordHash: defaultPasswordHash,
      },
      {
        username: "dosen.budi",
        nip: "198203142010121003",
        fullName: "Dr. Budi Santoso",
        email: "budi.santoso@silab-kl.local",
        role: "dosen",
        passwordHash: defaultPasswordHash,
      },
      {
        username: "P27834021001",
        nim: "P27834021001",
        fullName: "Siti Aminah",
        role: "mahasiswa",
        passwordHash: defaultPasswordHash,
      },
      {
        username: "P27834021015",
        nim: "P27834021015",
        fullName: "Ahmad Fauzi",
        role: "mahasiswa",
        passwordHash: defaultPasswordHash,
      },
      {
        username: "P27834021008",
        nim: "P27834021008",
        fullName: "Dewi Lestari",
        role: "mahasiswa",
        passwordHash: defaultPasswordHash,
      },
    ])
    .returning({ id: users.id, username: users.username })

  const userByUsername = Object.fromEntries(insertedUsers.map((user) => [user.username, user]))

  await db.insert(userLabAssignments).values([
    { userId: userByUsername["plp.suryani"].id, labId: labByCode["LAB-HEM"].id },
    { userId: userByUsername["plp.suryani"].id, labId: labByCode["LAB-PAR"].id },
    { userId: userByUsername["plp.hartono"].id, labId: labByCode["LAB-KIM"].id },
    { userId: userByUsername["plp.hartono"].id, labId: labByCode["LAB-MIK"].id },
    { userId: userByUsername["dosen.rahma"].id, labId: labByCode["LAB-HEM"].id },
    { userId: userByUsername["dosen.rahma"].id, labId: labByCode["LAB-PAR"].id },
    { userId: userByUsername["dosen.budi"].id, labId: labByCode["LAB-KIM"].id },
  ])

  await db.insert(borrowingApprovalMatrices).values([
    {
      labId: labByCode["LAB-HEM"].id,
      isActive: true,
      step1ApproverUserId: userByUsername["dosen.rahma"].id,
      step2ApproverUserId: userByUsername["plp.suryani"].id,
    },
    {
      labId: labByCode["LAB-PAR"].id,
      isActive: true,
      step1ApproverUserId: userByUsername["dosen.rahma"].id,
      step2ApproverUserId: userByUsername["plp.suryani"].id,
    },
    {
      labId: labByCode["LAB-KIM"].id,
      isActive: true,
      step1ApproverUserId: userByUsername["dosen.budi"].id,
      step2ApproverUserId: userByUsername["plp.hartono"].id,
    },
    {
      labId: labByCode["LAB-MIK"].id,
      isActive: false,
      step1ApproverUserId: null,
      step2ApproverUserId: userByUsername["plp.hartono"].id,
    },
  ])

  const insertedToolModels = await db
    .insert(toolModels)
    .values([
      {
        labId: labByCode["LAB-HEM"].id,
        code: "TM-MIK-BINO",
        name: "Mikroskop Binokuler",
        category: "Optik",
        imageUrl: "/images/tools/microscope.jpg",
      },
      {
        labId: labByCode["LAB-KIM"].id,
        code: "TM-SPK-UVVIS",
        name: "Spektrofotometer UV-Vis",
        category: "Analitik",
        imageUrl: "/images/tools/spectro.jpg",
      },
      {
        labId: labByCode["LAB-HEM"].id,
        code: "TM-CENT-12K",
        name: "Centrifuge 12000 RPM",
        category: "Pemisahan",
        imageUrl: "/images/tools/centrifuge.jpg",
      },
      {
        labId: labByCode["LAB-MIK"].id,
        code: "TM-AUTO-50L",
        name: "Autoclave 50L",
        category: "Sterilisasi",
      },
      {
        labId: labByCode["LAB-KIM"].id,
        code: "TM-PH-DIG",
        name: "pH Meter Digital",
        category: "Analitik",
      },
      {
        labId: labByCode["LAB-MIK"].id,
        code: "TM-LAF",
        name: "Laminar Air Flow",
        category: "Sterilisasi",
        imageUrl: "/images/tools/laf.jpg",
      },
    ])
    .returning({ id: toolModels.id, code: toolModels.code })

  const modelByCode = Object.fromEntries(insertedToolModels.map((m) => [m.code, m]))

  await db.insert(toolAssets).values([
    {
      toolModelId: modelByCode["TM-MIK-BINO"].id,
      assetCode: "T001-01",
      qrCodeValue: "QR-T001-01",
      status: "available",
      condition: "baik",
    },
    {
      toolModelId: modelByCode["TM-MIK-BINO"].id,
      assetCode: "T001-02",
      qrCodeValue: "QR-T001-02",
      status: "available",
      condition: "baik",
    },
    {
      toolModelId: modelByCode["TM-SPK-UVVIS"].id,
      assetCode: "T002-01",
      qrCodeValue: "QR-T002-01",
      status: "borrowed",
      condition: "baik",
    },
    {
      toolModelId: modelByCode["TM-CENT-12K"].id,
      assetCode: "T003-01",
      qrCodeValue: "QR-T003-01",
      status: "available",
      condition: "baik",
    },
    {
      toolModelId: modelByCode["TM-AUTO-50L"].id,
      assetCode: "T004-01",
      qrCodeValue: "QR-T004-01",
      status: "maintenance",
      condition: "maintenance",
    },
    {
      toolModelId: modelByCode["TM-PH-DIG"].id,
      assetCode: "T006-01",
      qrCodeValue: "QR-T006-01",
      status: "borrowed",
      condition: "baik",
    },
    {
      toolModelId: modelByCode["TM-LAF"].id,
      assetCode: "T010-01",
      qrCodeValue: "QR-T010-01",
      status: "available",
      condition: "baik",
    },
  ])

  await db.insert(consumableItems).values([
    {
      labId: labByCode["LAB-KIM"].id,
      code: "C001",
      name: "Objek Glass",
      category: "Gelas",
      unit: "box",
      stockQty: 45,
      minStockQty: 20,
    },
    {
      labId: labByCode["LAB-KIM"].id,
      code: "C002",
      name: "Cover Glass",
      category: "Gelas",
      unit: "box",
      stockQty: 38,
      minStockQty: 20,
    },
    {
      labId: labByCode["LAB-HEM"].id,
      code: "C003",
      name: "Tabung EDTA 3mL",
      category: "Tabung",
      unit: "pack",
      stockQty: 12,
      minStockQty: 15,
    },
    {
      labId: labByCode["LAB-KIM"].id,
      code: "C004",
      name: "Reagen Giemsa",
      category: "Reagen",
      unit: "botol",
      stockQty: 8,
      minStockQty: 5,
    },
    {
      labId: labByCode["LAB-MIK"].id,
      code: "C006",
      name: "Sarung Tangan (M)",
      category: "APD",
      unit: "box",
      stockQty: 5,
      minStockQty: 10,
    },
  ])

  console.log("Seed selesai: labs, users, assignments, tool models/assets, consumables.")
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    // Neon HTTP driver does not require explicit disconnect
  })
