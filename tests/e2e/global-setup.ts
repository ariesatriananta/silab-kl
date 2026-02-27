import { execSync } from "node:child_process"

async function globalSetup() {
  execSync("pnpm db:migrate", { stdio: "inherit" })
  execSync("pnpm db:seed", { stdio: "inherit" })
  execSync("tsx scripts/seed-e2e-passwords.ts", { stdio: "inherit" })
}

export default globalSetup
