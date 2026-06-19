import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://site.api.espn.com/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        events: [
          {
            id: "event_1",
            name: "Mexico vs South Africa",
            competitions: [
              {
                id: "401000001",
                date: "2026-06-19T20:00:00Z",
                altGameNote: "FIFA World Cup, Group A",
                status: { type: { state: "pre", shortDetail: "Scheduled" } },
                competitors: [
                  { homeAway: "home", score: "0", team: { abbreviation: "MEX" } },
                  { homeAway: "away", score: "0", team: { abbreviation: "RSA" } },
                ],
                venue: { fullName: "Test Stadium", address: { city: "Test City" } },
              },
            ],
          },
          {
            id: "event_2",
            name: "Mexico vs South Africa",
            competitions: [
              {
                id: "401000002",
                date: "2026-06-19T22:00:00Z",
                altGameNote: "FIFA World Cup, Group A",
                status: { type: { state: "in", shortDetail: "In Progress" }, displayClock: "45:00" },
                competitors: [
                  { homeAway: "home", score: "1", team: { abbreviation: "MEX" } },
                  { homeAway: "away", score: "0", team: { abbreviation: "RSA" } },
                ],
              },
            ],
          },
          {
            id: "event_3",
            name: "Mexico vs South Africa",
            competitions: [
              {
                id: "401000003",
                date: "2026-06-20T00:00:00Z",
                altGameNote: "FIFA World Cup, Group A",
                status: { type: { state: "pre", shortDetail: "Scheduled" } },
                competitors: [
                  { homeAway: "home", score: "0", team: { abbreviation: "MEX" } },
                  { homeAway: "away", score: "0", team: { abbreviation: "RSA" } },
                ],
              },
            ],
          },
        ],
      }),
    });
  });
});

test("renders dashboard and core tabs", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "Live match data is stale or unavailable" })).toBeHidden();

  const headerTitle = page.getByRole("heading", { name: "Famiry 2026" });
  await expect(headerTitle).toBeVisible();
  await expect(headerTitle.locator("..")).toHaveCSS("text-align", isMobile ? "center" : "left");
  await expect(page.getByText("World Cup bracket challenge")).toBeVisible();
  await expect(page.getByText("Bracket dashboard", { exact: true })).toHaveCount(0);
  const updatedBadge = page.getByText(/^Updated /);
  if (isMobile) {
    await expect(updatedBadge).toBeHidden();
  } else {
    await expect(updatedBadge).toBeVisible();
  }
  const visibleHeaderMatchCards = page.locator('[data-testid="header-match-card"]:visible');
  await expect(page.getByLabel("Today's matches")).toHaveCSS("justify-content", isMobile ? "center" : "flex-start");
  await expect(visibleHeaderMatchCards).toHaveCount(isMobile ? 1 : 3);
  const firstHeaderMatchCard = visibleHeaderMatchCards.first();
  await expect(firstHeaderMatchCard).toHaveCSS("min-width", "250px");
  const [cardBox, statusBox] = await Promise.all([
    firstHeaderMatchCard.boundingBox(),
    firstHeaderMatchCard.getByTestId("header-match-status").boundingBox(),
  ]);
  await expect(firstHeaderMatchCard.getByTestId("header-match-status")).toHaveCSS("min-width", "72px");
  expect(cardBox).not.toBeNull();
  expect(statusBox).not.toBeNull();
  expect(cardBox!.x + cardBox!.width - statusBox!.x - statusBox!.width).toBeLessThanOrEqual(10);
  await expect(page.getByLabel("Today's matches").getByText(/LIVE 45'/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top Third-Place Picks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top Third-Place Picks" }).locator("..").getByTitle(/ flag$/).first()).toBeVisible();

  await page.getByRole("tab", { name: "Participants" }).click();
  await expect(page.getByRole("cell", { name: "Leppy27" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "BRA" }).first()).toBeVisible();
  await expect(page.getByTitle("BRA flag").first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Champion" })).toHaveCSS("text-align", "center");
  await expect(page.getByRole("columnheader", { name: "Bracket" })).toHaveCSS("text-align", "center");
  await expect(page.getByRole("cell", { name: "BRA" }).first()).toHaveCSS("text-align", "center");
  await expect(page.getByRole("cell", { name: "View" }).first()).toHaveCSS("text-align", "center");
  const participantsTable = page.locator(".MuiTableContainer-root");
  const tableDimensions = await participantsTable.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(tableDimensions.scrollWidth).toBeLessThanOrEqual(tableDimensions.clientWidth);

  await page.getByRole("tab", { name: "Groups" }).click();
  const groupACard = page.getByRole("heading", { name: "Group A" }).locator("..");
  await expect(groupACard.getByText("MEX", { exact: true })).toBeVisible();
  await expect(groupACard.getByTitle("MEX flag")).toBeVisible();

  for (const [tab, hint] of [
    ["Knockout", "Scroll horizontally to inspect the full bracket"],
    ["Compare", "Scroll horizontally to inspect the full comparison"],
  ] as const) {
    await page.getByRole("tab", { name: tab }).click();
    const scrollHint = page.getByText(hint, { exact: true });
    if (isMobile) {
      await expect(scrollHint).toBeVisible();
    } else {
      await expect(scrollHint).toBeHidden();
    }
  }
  const compareArrow = page.getByTestId("CompareArrowsIcon");
  if (isMobile) {
    await expect(compareArrow).toBeHidden();
  } else {
    await expect(compareArrow).toBeVisible();
  }

  await page.getByRole("tab", { name: "Schedule" }).click();
  for (const header of ["Kickoff", "Match", "Score"]) {
    await expect(page.locator("th:visible", { hasText: new RegExp(`^${header}$`) }).first()).toBeVisible();
  }
  for (const header of ["Group", "Status", "Venue"]) {
    const visibleColumnHeaders = page.locator("th:visible", { hasText: new RegExp(`^${header}$`) });
    if (isMobile) {
      await expect(visibleColumnHeaders).toHaveCount(0);
    } else {
      await expect(visibleColumnHeaders.first()).toBeVisible();
    }
  }

  await page.getByRole("tab", { name: "Leaderboard" }).click();
  const leaderboardScrollHint = page.getByText("Scroll horizontally to inspect the full leaderboard", { exact: true });
  if (isMobile) {
    await expect(leaderboardScrollHint).toBeVisible();
  } else {
    await expect(leaderboardScrollHint).toBeHidden();
  }
  await expect(page.getByRole("columnheader", { name: "Total" })).toBeVisible();
});

test("keeps every dashboard section within the page viewport", async ({ page }) => {
  await page.goto("/");

  for (const tab of ["Overview", "Participants", "Groups", "Knockout", "Schedule", "Compare", "Leaderboard"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("heading", { name: tab, exact: true })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  }
});
