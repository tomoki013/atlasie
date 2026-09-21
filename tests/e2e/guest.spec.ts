import path from "node:path";
import { expect, test } from "@playwright/test";

test("guest photo and memory survive reload and appear in the map and timeline", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "サンプルの旅", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "場所を追加", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("訪問した場所を検索").fill("京都");
  await dialog
    .getByRole("button", { name: "京都 🇯🇵 日本", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "この場所を追加", exact: true })
    .click();
  await dialog
    .locator("input[type=file]")
    .setInputFiles(path.resolve("tests/fixtures/landscape.png"));
  await expect(dialog.getByAltText("追加する写真 1")).toBeVisible();
  await dialog
    .getByRole("button", { name: "思い出を書く", exact: true })
    .click();
  await dialog.getByLabel("タイトル").fill("テスト：京都の思い出");
  await dialog.getByLabel("メモ").fill("写真と一緒に保存する。");
  await dialog
    .getByRole("button", { name: "この思い出を保存", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "保存しました" }),
  ).toContainText("保存しました");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "自分の旅 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "日本・京都を表示", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", { name: "この国の思い出を見る", exact: true })
    .click();
  await page.getByRole("button", { name: "思い出を編集", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("メモ")
    .fill("編集しても写真を残す。");
  await page.getByRole("button", { name: "変更を保存", exact: true }).click();
  await expect(
    page.getByText("編集しても写真を残す。", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "この国の思い出を見る", exact: true })
    .click();
  await expect(
    page.getByText("編集しても写真を残す。", { exact: true }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", {
    name:
      test.info().project.name === "mobile"
        ? "モバイルナビゲーション"
        : "メインナビゲーション",
  });
  await nav.getByRole("button", { name: "旅の記録", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "テスト：京都の思い出", exact: true }),
  ).toBeVisible();
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "メニュー", exact: true }).click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await page.getByLabel("旅をまとめる", { exact: true }).fill("京都の秋旅");
  await page.getByRole("button", { name: "旅を作成", exact: true }).click();
  await page
    .getByRole("combobox", { name: "テスト：京都の思い出の旅", exact: true })
    .selectOption({ label: "京都の秋旅" });
  await expect(page.getByText("1件の記録", { exact: true })).toBeVisible();
  await page.reload();
  await nav.getByRole("button", { name: "旅の記録", exact: true }).click();
  await page.getByRole("button", { name: "旅ごとに見る", exact: true }).click();
  await page.getByRole("button", { name: "京都の秋旅", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /テスト：京都の思い出.*京都/ }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "写真", exact: true }).click();
  await expect(page.getByAltText("京都の旅の写真 1")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("private app is noindex and unconfigured login cannot pretend to save", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("meta[name=robots]")).toHaveAttribute(
    "content",
    /noindex/,
  );
  await page.getByRole("button", { name: "地図を保存", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Googleで続ける/ }),
  ).toBeDisabled();
  await expect(page.getByRole("dialog")).toContainText("準備中");
});

test("a country can be recorded without choosing a city", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "場所を追加", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "国だけを記録", exact: true })
    .click();
  await dialog.getByLabel("訪問した場所を検索").fill("アイスランド");
  await dialog
    .getByRole("button", { name: "アイスランド 🇮🇸 アイスランド", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "この場所を追加", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "写真なしで続ける", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "この思い出を保存", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "アイスランド", exact: true }).first(),
  ).toBeVisible();
});
test("a searched city is stored with its own UUID and survives reload", async ({
  page,
}) => {
  await page.route("https://photon.komoot.io/api/**", (route) =>
    route.fulfill({
      json: {
        features: [
          {
            geometry: { coordinates: [135.5, 34.7] },
            properties: {
              name: "大阪城",
              countrycode: "JP",
              country: "Japan",
              city: "大阪市",
            },
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "場所を追加", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("訪問した場所を検索").fill("大阪城");
  await dialog
    .getByRole("button", { name: "世界の場所を検索", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "大阪城 🇯🇵 日本", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "この場所を追加", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "写真なしで続ける", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "この思い出を保存", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "日本・大阪城を表示", exact: true }),
  ).toBeVisible({ timeout: 60000 });
});

test("sample browsing never fills the guest profile and map gestures allow page scrolling", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("サンプルの世界地図", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "プロフィール", exact: true }).click();
  await expect(page.locator(".profile-stats strong")).toHaveText([
    "0",
    "0",
    "0",
  ]);
  await expect(
    page.getByRole("button", { name: "サンプルの旅", exact: true }),
  ).toHaveCount(0);
  const nav = page.getByRole("navigation", {
    name:
      test.info().project.name === "mobile"
        ? "モバイルナビゲーション"
        : "メインナビゲーション",
  });
  await nav.getByRole("button", { name: "世界地図", exact: true }).click();
  await page.getByRole("button", { name: "サンプルの旅", exact: true }).click();
  await page.locator(".maplibregl-canvas").waitFor();
  await page.locator(".maplibregl-canvas").hover();
  await page.mouse.wheel(0, 1500);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  await page.locator(".page-footer").scrollIntoViewIfNeeded();
  const footer = await page.locator(".page-footer").boundingBox();
  const bottomNav = await page.locator(".bottom-nav").boundingBox();
  if (test.info().project.name === "mobile") {
    if (!footer || !bottomNav) throw new Error("Missing footer or navigation");
    expect(footer.y + footer.height).toBeLessThanOrEqual(bottomNav.y);
  }
  await page.getByRole("button", { name: "地図を保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("自分の旅」の0件");
  await expect(page.getByRole("dialog")).toContainText(
    "サンプルの旅は含まれません",
  );
});

test("closing the country panel expands the map and the time slider grows visited places", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.goto("/");
  await page
    .getByRole("button", { name: "国のプレビューを閉じる", exact: true })
    .click();
  await expect(page.locator(".country-preview")).toHaveCount(0);
  await expect(page.locator(".map-invitation")).toHaveCount(0);
  await expect
    .poll(async () => {
      const card = await page.locator(".world-card").boundingBox();
      const canvas = await page.locator(".map-canvas").boundingBox();
      return card && canvas ? Math.abs(card.width - canvas.width) : 999;
    })
    .toBeLessThan(4);
  const slider = page.getByRole("slider", { name: "地図に表示する時点" });
  await slider.focus();
  await slider.press("Home");
  await expect(page.locator(".photo-pin")).toHaveCount(0);
  await slider.press("ArrowRight");
  await expect(page.locator(".photo-pin")).toHaveCount(1);
  await slider.press("End");
  await expect(page.locator(".photo-pin")).toHaveCount(6);
  // Control playback time so a busy machine cannot skip the first frame.
  await page.clock.pauseAt(new Date("2026-01-01T02:00:00Z"));
  await page
    .getByRole("button", { name: "地図の歩みを再生", exact: true })
    .click();
  await expect(page.locator(".photo-pin")).toHaveCount(0);
  await page.clock.runFor(1100);
  await expect(page.locator(".photo-pin")).toHaveCount(1);
  await page
    .getByRole("button", { name: "地図の再生を一時停止", exact: true })
    .click();
  await page.getByRole("button", { name: "すべて", exact: true }).click();
  await expect(page.locator(".photo-pin")).toHaveCount(6);
  await page.getByRole("button", { name: "自分の旅 0", exact: true }).click();
  await expect(slider).toBeDisabled();
  await expect(page.locator(".photo-pin")).toHaveCount(0);
});
