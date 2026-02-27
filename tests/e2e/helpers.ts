import { expect, type Browser, type Page } from "@playwright/test"

type LoginInput = {
  username: string
  password: string
  nextPassword?: string
}

export async function openSession(browser: Browser, input: LoginInput) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await login(page, input)
  return { context, page }
}

export async function login(page: Page, input: LoginInput) {
  await page.goto("/")
  await page.fill("#username", input.username)
  await page.fill("#password", input.password)
  await page.locator("form button[type='submit']").click()

  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 45_000 })
  if (page.url().includes("/dashboard/account/security")) {
    const nextPassword = input.nextPassword ?? `${input.password}#new`
    await page.fill("#currentPassword", input.password)
    await page.fill("#newPassword", nextPassword)
    await page.fill("#confirmPassword", nextPassword)
    await page.getByRole("button", { name: "Ubah Password" }).click()
    await page.waitForURL("**/")

    await page.fill("#username", input.username)
    await page.fill("#password", nextPassword)
    await page.locator("form button[type='submit']").click()
    await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 45_000 })
  }

  await expect(page).toHaveURL(/\/dashboard(\/|$)/)
  await expect(page).not.toHaveURL(/\/dashboard\/account\/security/)
}

export async function selectOptionByLabel(page: Page, label: string, optionText: string | RegExp) {
  const row = page.locator("div").filter({ has: page.getByText(label, { exact: false }) }).first()
  const trigger = row.locator("button[role='combobox']").first()
  await trigger.click()
  await page.getByRole("option", { name: optionText }).click()
}

export async function selectOptionById(page: Page, id: string, optionText: string | RegExp) {
  await page.locator(`#${id}`).click()
  await page.getByRole("option", { name: optionText }).click()
}
