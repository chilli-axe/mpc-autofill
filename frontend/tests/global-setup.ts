import { chromium, FullConfig } from "@playwright/test";
import { mkdirSync } from "fs";

const STORAGE_STATE_PATH = "playwright/.auth/cookies.json";

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  mkdirSync("playwright/.auth", { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/about`);
  await page.getByRole("button", { name: "Opt out" }).click();
  await page.context().storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}

export default globalSetup;
