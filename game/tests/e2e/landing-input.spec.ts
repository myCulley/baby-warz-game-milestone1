import { expect, test } from "@playwright/test";

test("playground names accept gameplay control keys", async ({ page }) => {
  await page.goto("/");

  const name = page.getByLabel("Your playground name");
  await name.pressSequentially("WASD Space");

  await expect(name).toHaveValue("WASD Space");
});
