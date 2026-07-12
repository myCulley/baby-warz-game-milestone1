import { expect, test } from "@playwright/test";

test("two players form teams, start, move, and admit a late spectator", async ({
  browser,
}) => {
  const host = await browser.newPage();
  const guest = await browser.newPage();
  await host.goto("/");
  await guest.goto("/");
  await host.getByLabel("Your playground name").fill("Host Baby");
  await host.getByRole("button", { name: "Create lobby" }).click();
  await expect(host.getByText("Pick a riverbank")).toBeVisible();
  await guest.getByLabel("Your playground name").fill("Guest Baby");
  await guest.getByRole("button", { name: "Join existing" }).click();
  await host.getByRole("button", { name: /Coral chevrons/ }).click();
  await guest.getByRole("button", { name: /Teal bars/ }).click();
  await expect(host.getByText("Guest Baby")).toBeVisible();
  await host.getByRole("button", { name: "Start match" }).click();
  await expect(host.getByText("LAST TEAM STANDING")).toBeVisible();
  await host.keyboard.down("KeyW");
  await host.waitForTimeout(300);
  await host.keyboard.up("KeyW");
  const spectator = await browser.newPage();
  await spectator.goto("/");
  await spectator.getByLabel("Your playground name").fill("Late Baby");
  await spectator.getByRole("button", { name: "Join existing" }).click();
  await expect(spectator.getByText(/SPECTATING/)).toBeVisible();
  await host.close();
  await guest.close();
  await spectator.close();
});
