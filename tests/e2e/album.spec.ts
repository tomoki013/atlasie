import { expect, test } from "@playwright/test";

const navigation = (project: string) =>
  project === "mobile" ? "モバイルナビゲーション" : "メインナビゲーション";

test("album filters, ordering and immersive viewer work together", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: navigation(test.info().project.name) })
    .getByRole("button", { name: "写真", exact: true })
    .click();
  const grid = page.locator(".album-grid");
  await expect(grid.getByRole("button")).toHaveCount(6);
  await page.getByLabel("写真の年", { exact: true }).selectOption("2023");
  await expect(grid.getByRole("button")).toHaveCount(1);
  await expect(grid.getByAltText("シドニーの旅の写真 1")).toBeVisible();
  await page.getByLabel("写真の国", { exact: true }).selectOption("JP");
  await expect(grid.getByRole("button")).toHaveCount(0);
  await expect(
    page.getByText("この条件の写真は、まだありません。", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "絞り込みをクリア" }).click();
  await page.getByLabel("写真の思い出を検索").fill("サントリーニ");
  await expect(grid.getByRole("button")).toHaveCount(1);
  await page.getByLabel("写真の思い出を検索").fill("みつからないことば");
  await expect(grid.getByRole("button")).toHaveCount(0);
  await page.getByRole("button", { name: "絞り込みをクリア" }).click();
  await page.getByLabel("写真の並び順").selectOption("oldest");
  const first = grid.getByRole("button").first();
  await expect(first).toContainText("シドニー");
  await first.click();
  const viewer = page.getByRole("dialog", { name: "写真ビューアー" });
  await expect(viewer).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "前の写真", exact: true }),
  ).toBeDisabled();
  await expect(viewer.locator("output")).toHaveText("1 / 6");
  await viewer.press("ArrowRight");
  await expect(viewer.locator("output")).toHaveText("2 / 6");
  await expect(viewer.getByAltText("バンフの旅の写真 1")).toBeVisible();
  await viewer.press("ArrowLeft");
  await expect(viewer.locator("output")).toHaveText("1 / 6");
  await viewer.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(first).toBeFocused();
  await first.click();
  await viewer.getByRole("button", { name: "この国の思い出へ" }).click();
  await expect(
    page.getByRole("heading", { name: "オーストラリアの思い出", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("timeline searches memories and guest highlights never inherit sample counts", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", {
    name: navigation(test.info().project.name),
  });
  await page.getByRole("button", { name: "自分の旅 0", exact: true }).click();
  await expect(page.locator(".passport-stats strong")).toHaveText([
    "0",
    "0",
    "0",
  ]);
  await expect(page.locator(".memory-start")).toBeVisible();
  await page.getByRole("button", { name: "サンプルの旅", exact: true }).click();
  await nav.getByRole("button", { name: "旅の記録", exact: true }).click();
  await page
    .getByLabel("旅の記録を検索", { exact: true })
    .fill("心が躍っていた");
  await expect(page.locator(".timeline-row")).toHaveCount(1);
  await expect(page.locator(".timeline-row")).toContainText("サントリーニ島");
  await page.getByLabel("年で絞り込む").selectOption("2023");
  await expect(page.locator(".timeline-row")).toHaveCount(0);
  await page
    .getByRole("button", { name: "すべての記録を見る", exact: true })
    .click();
  await expect(page.locator(".timeline-row")).toHaveCount(6);
});
