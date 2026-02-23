// Mock data for SILAB-KL

export const statsData = {
  availableTools: 248,
  borrowedTools: 32,
  overdue: 5,
  damaged: 3,
}

export const recentActivities = [
  { id: 1, user: "Siti Aminah", action: "Meminjam Mikroskop Binokuler", time: "10 menit lalu", type: "borrow" as const },
  { id: 2, user: "Ahmad Fauzi", action: "Mengembalikan Pipet Volumetrik", time: "25 menit lalu", type: "return" as const },
  { id: 3, user: "Dewi Lestari", action: "Melaporkan kerusakan Centrifuge", time: "1 jam lalu", type: "damage" as const },
  { id: 4, user: "Budi Santoso", action: "Meminjam Spektrofotometer", time: "2 jam lalu", type: "borrow" as const },
  { id: 5, user: "Rina Wati", action: "Mengembalikan Autoclave", time: "3 jam lalu", type: "return" as const },
]

export const labOverview = [
  { name: "Lab Kimia Klinik", toolCount: 85, usageRate: 72, status: "active" as const },
  { name: "Lab Hematologi", toolCount: 64, usageRate: 58, status: "active" as const },
  { name: "Lab Mikrobiologi", toolCount: 52, usageRate: 45, status: "active" as const },
  { name: "Lab Parasitologi", toolCount: 47, usageRate: 30, status: "maintenance" as const },
]

export const overdueAlerts = [
  { id: 1, tool: "Mikroskop Binokuler #12", borrower: "Siti Aminah", dueDate: "2026-02-20", daysOverdue: 3 },
  { id: 2, tool: "Pipet Mikro 100μL", borrower: "Ahmad Fauzi", dueDate: "2026-02-18", daysOverdue: 5 },
  { id: 3, tool: "pH Meter Digital", borrower: "Rina Wati", dueDate: "2026-02-21", daysOverdue: 2 },
]

export const tools = [
  { id: "T001", name: "Mikroskop Binokuler", category: "Optik", lab: "Lab Hematologi", status: "available" as const, condition: "Baik", qrCode: "QR-T001" },
  { id: "T002", name: "Spektrofotometer UV-Vis", category: "Analitik", lab: "Lab Kimia Klinik", status: "borrowed" as const, condition: "Baik", qrCode: "QR-T002" },
  { id: "T003", name: "Centrifuge 12000 RPM", category: "Pemisahan", lab: "Lab Hematologi", status: "available" as const, condition: "Baik", qrCode: "QR-T003" },
  { id: "T004", name: "Autoclave 50L", category: "Sterilisasi", lab: "Lab Mikrobiologi", status: "maintenance" as const, condition: "Perlu Perbaikan", qrCode: "QR-T004" },
  { id: "T005", name: "Pipet Volumetrik 10mL", category: "Ukur", lab: "Lab Kimia Klinik", status: "available" as const, condition: "Baik", qrCode: "QR-T005" },
  { id: "T006", name: "pH Meter Digital", category: "Analitik", lab: "Lab Kimia Klinik", status: "borrowed" as const, condition: "Baik", qrCode: "QR-T006" },
  { id: "T007", name: "Inkubator CO2", category: "Kultur", lab: "Lab Mikrobiologi", status: "available" as const, condition: "Baik", qrCode: "QR-T007" },
  { id: "T008", name: "Hematology Analyzer", category: "Analitik", lab: "Lab Hematologi", status: "available" as const, condition: "Baik", qrCode: "QR-T008" },
  { id: "T009", name: "Electrolyte Analyzer", category: "Analitik", lab: "Lab Kimia Klinik", status: "damaged" as const, condition: "Rusak", qrCode: "QR-T009" },
  { id: "T010", name: "Laminar Air Flow", category: "Sterilisasi", lab: "Lab Mikrobiologi", status: "available" as const, condition: "Baik", qrCode: "QR-T010" },
]

export const borrowings = [
  {
    id: "B001",
    borrower: "Siti Aminah",
    nim: "P27834021001",
    items: [
      { tool: "Mikroskop Binokuler #12", qty: 1 },
      { tool: "Objek Glass (box)", qty: 2 },
    ],
    borrowDate: "2026-02-18",
    dueDate: "2026-02-20",
    returnDate: null,
    status: "overdue" as const,
    purpose: "Praktikum Hematologi",
    approvedBy: "Dr. Suryani",
  },
  {
    id: "B002",
    borrower: "Ahmad Fauzi",
    nim: "P27834021015",
    items: [
      { tool: "Spektrofotometer UV-Vis", qty: 1 },
    ],
    borrowDate: "2026-02-22",
    dueDate: "2026-02-25",
    returnDate: null,
    status: "active" as const,
    purpose: "Praktikum Kimia Klinik",
    approvedBy: "Dr. Hartono",
  },
  {
    id: "B003",
    borrower: "Dewi Lestari",
    nim: "P27834021008",
    items: [
      { tool: "pH Meter Digital", qty: 1 },
      { tool: "Buffer pH 7.0", qty: 1 },
      { tool: "Buffer pH 4.0", qty: 1 },
    ],
    borrowDate: "2026-02-21",
    dueDate: "2026-02-23",
    returnDate: "2026-02-23",
    status: "returned" as const,
    purpose: "Praktikum Urinalisis",
    approvedBy: "Dr. Suryani",
  },
  {
    id: "B004",
    borrower: "Budi Santoso",
    nim: "P27834021022",
    items: [
      { tool: "Centrifuge 12000 RPM", qty: 1 },
      { tool: "Tabung Centrifuge 15mL", qty: 10 },
    ],
    borrowDate: "2026-02-23",
    dueDate: "2026-02-25",
    returnDate: null,
    status: "pending" as const,
    purpose: "Penelitian Tugas Akhir",
    approvedBy: null,
  },
]

export const consumables = [
  { id: "C001", name: "Objek Glass", unit: "box", stock: 45, minStock: 20, category: "Gelas", lastRestocked: "2026-02-15" },
  { id: "C002", name: "Cover Glass", unit: "box", stock: 38, minStock: 20, category: "Gelas", lastRestocked: "2026-02-15" },
  { id: "C003", name: "Tabung EDTA 3mL", unit: "pack", stock: 12, minStock: 15, category: "Tabung", lastRestocked: "2026-02-10" },
  { id: "C004", name: "Reagen Giemsa", unit: "botol", stock: 8, minStock: 5, category: "Reagen", lastRestocked: "2026-02-08" },
  { id: "C005", name: "Alkohol 70%", unit: "liter", stock: 15, minStock: 10, category: "Reagen", lastRestocked: "2026-02-12" },
  { id: "C006", name: "Sarung Tangan (M)", unit: "box", stock: 5, minStock: 10, category: "APD", lastRestocked: "2026-02-05" },
  { id: "C007", name: "Masker Bedah", unit: "box", stock: 22, minStock: 10, category: "APD", lastRestocked: "2026-02-18" },
  { id: "C008", name: "Tip Mikropipet 100μL", unit: "pack", stock: 30, minStock: 15, category: "Tip", lastRestocked: "2026-02-14" },
]

export const materialRequests = [
  { id: "R001", requestor: "Lab Hematologi", items: "Tabung EDTA 3mL (5 pack)", date: "2026-02-22", status: "pending" as const },
  { id: "R002", requestor: "Lab Kimia Klinik", items: "Reagen Giemsa (3 botol)", date: "2026-02-21", status: "approved" as const },
  { id: "R003", requestor: "Lab Mikrobiologi", items: "Sarung Tangan M (10 box)", date: "2026-02-20", status: "fulfilled" as const },
]

export const labSchedules = [
  { id: "L001", lab: "Lab Kimia Klinik", course: "Praktikum Kimia Klinik I", group: "Kelompok A", date: "2026-02-24", time: "08:00 - 10:00", instructor: "Dr. Hartono", capacity: 30, enrolled: 28 },
  { id: "L002", lab: "Lab Hematologi", course: "Praktikum Hematologi II", group: "Kelompok B", date: "2026-02-24", time: "10:00 - 12:00", instructor: "Dr. Suryani", capacity: 25, enrolled: 25 },
  { id: "L003", lab: "Lab Mikrobiologi", course: "Praktikum Mikrobiologi Klinik", group: "Kelompok C", date: "2026-02-24", time: "13:00 - 15:00", instructor: "Dr. Wibowo", capacity: 20, enrolled: 18 },
  { id: "L004", lab: "Lab Parasitologi", course: "Praktikum Parasitologi", group: "Kelompok A", date: "2026-02-25", time: "08:00 - 10:00", instructor: "Dr. Astuti", capacity: 25, enrolled: 22 },
  { id: "L005", lab: "Lab Kimia Klinik", course: "Praktikum Urinalisis", group: "Kelompok D", date: "2026-02-25", time: "10:00 - 12:00", instructor: "Dr. Hartono", capacity: 30, enrolled: 27 },
]

export const usageHistory = [
  { id: "U001", lab: "Lab Kimia Klinik", date: "2026-02-21", course: "Kimia Klinik I", group: "Kel. A", students: 28, duration: "2 jam" },
  { id: "U002", lab: "Lab Hematologi", date: "2026-02-21", course: "Hematologi II", group: "Kel. B", students: 25, duration: "2 jam" },
  { id: "U003", lab: "Lab Mikrobiologi", date: "2026-02-20", course: "Mikro Klinik", group: "Kel. C", students: 18, duration: "2 jam" },
  { id: "U004", lab: "Lab Kimia Klinik", date: "2026-02-20", course: "Urinalisis", group: "Kel. D", students: 27, duration: "2 jam" },
]

export const studentTools = [
  { id: "T001", name: "Mikroskop Binokuler", image: "/images/tools/microscope.jpg", available: 8, total: 12, lab: "Lab Hematologi", category: "Optik" },
  { id: "T002", name: "Spektrofotometer UV-Vis", image: "/images/tools/spectro.jpg", available: 0, total: 2, lab: "Lab Kimia Klinik", category: "Analitik" },
  { id: "T003", name: "Centrifuge 12000 RPM", image: "/images/tools/centrifuge.jpg", available: 3, total: 4, lab: "Lab Hematologi", category: "Pemisahan" },
  { id: "T007", name: "Inkubator CO2", image: "/images/tools/incubator.jpg", available: 2, total: 2, lab: "Lab Mikrobiologi", category: "Kultur" },
  { id: "T008", name: "Hematology Analyzer", image: "/images/tools/analyzer.jpg", available: 1, total: 1, lab: "Lab Hematologi", category: "Analitik" },
  { id: "T010", name: "Laminar Air Flow", image: "/images/tools/laf.jpg", available: 1, total: 2, lab: "Lab Mikrobiologi", category: "Sterilisasi" },
]
