import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const now = Date.now();
  await page.route("https://site.api.espn.com/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/summary")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          commentary: [{
            sequence: 1,
            text: "Shot by Mexico.",
            play: { id: "play_1", type: { text: "Shot" }, clock: { displayValue: "45'" }, fieldPositionX: 0.72, fieldPositionY: 0.4 },
          }],
        }),
      });
      return;
    }
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
                date: new Date(now + 60 * 60 * 1000).toISOString(),
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
                date: new Date(now).toISOString(),
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
                date: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
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
  await page.getByLabel("Today's matches").getByText(/LIVE 45'/).click();
  await expect(page.getByRole("dialog")).toContainText("Shot by Mexico.");
  await expect(page.getByRole("dialog")).not.toContainText("Last play position");
  await page.getByRole("button", { name: "Close match details" }).click();
  const leaderboardHeading = page.getByRole("heading", { name: "Leaderboard", exact: true });
  if (isMobile) {
    await expect(leaderboardHeading).toHaveCount(0);
  } else {
    await expect(leaderboardHeading).toBeVisible();
  }
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Groups" }).click();
  const groupFilterHeading = page.getByRole("heading", { name: "Group Filter" });
  if (isMobile) {
    await expect(groupFilterHeading).toHaveCount(0);
  } else {
    await expect(groupFilterHeading).toBeVisible();
  }
  await expect(page.getByRole("columnheader", { name: "Group A" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Pos 1" })).toHaveCount(12);
  await expect(page.getByRole("rowheader", { name: "Leppy27" })).toBeVisible();
  const leppyRow = page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Leppy27" }) });
  await expect(leppyRow.getByText("MEX", { exact: true }).first()).toBeVisible();
  await expect(leppyRow.getByTitle("MEX flag").first()).toBeVisible();
  const correctMexicoPick = leppyRow.locator('[data-correct-position="true"]').filter({ hasText: "MEX" });
  await expect(correctMexicoPick).toHaveCount(1);
  await expect(correctMexicoPick).toHaveCSS("border-top-color", "rgb(19, 138, 75)");
  const groupsScrollHint = page.getByText("Scroll horizontally to compare all group picks", { exact: true });
  if (isMobile) {
    await expect(groupsScrollHint).toBeVisible();
  } else {
    await expect(groupsScrollHint).toBeHidden();
  }
  const groupsFilter = page.getByRole("group", { name: "Group filter" });
  if (isMobile) {
    const [filterBox, lastGroupButtonBox] = await Promise.all([
      groupsFilter.boundingBox(),
      groupsFilter.getByRole("button", { name: "Show Group L" }).boundingBox(),
    ]);
    expect(filterBox).not.toBeNull();
    expect(lastGroupButtonBox).not.toBeNull();
    expect(filterBox!.x + filterBox!.width - lastGroupButtonBox!.x - lastGroupButtonBox!.width).toBeLessThanOrEqual(1);
  }
  await expect(groupsFilter.getByRole("button", { name: "Show all groups" })).toHaveAttribute("aria-pressed", "true");
  await groupsFilter.getByRole("button", { name: "Show Group A" }).click();
  await expect(groupsFilter.getByRole("button", { name: "Show all groups" })).toHaveAttribute("aria-pressed", "false");
  await expect(groupsFilter.getByRole("button", { name: "Show Group A" })).toHaveAttribute("aria-pressed", "true");
  await groupsFilter.getByRole("button", { name: "Show Group B" }).click();
  await expect(page.getByRole("columnheader", { name: "Group A" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Group B" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Group C" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Pos 1" })).toHaveCount(2);
  await groupsFilter.getByRole("button", { name: "Show all groups" }).click();
  await expect(groupsFilter.getByRole("button", { name: "Show all groups" })).toHaveAttribute("aria-pressed", "true");
  await expect(groupsFilter.getByRole("button", { name: "Show Group A" })).toHaveAttribute("aria-pressed", "false");
  await expect(groupsFilter.getByRole("button", { name: "Show Group B" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("columnheader", { name: "Pos 1" })).toHaveCount(12);

  await page.getByRole("tab", { name: "Knockout" }).click();
  const roundFilterHeading = page.getByRole("heading", { name: "Round Filter" });
  if (isMobile) {
    await expect(roundFilterHeading).toHaveCount(0);
  } else {
    await expect(roundFilterHeading).toBeVisible();
  }
  await expect(page.getByRole("columnheader", { name: "Round of 32" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Match 1", exact: true })).toHaveCount(5);
  await expect(page.getByRole("rowheader", { name: "Leppy27" })).toBeVisible();
  const roundFilter = page.getByRole("group", { name: "Round filter" });
  await expect(roundFilter.getByRole("button", { name: "Show all rounds" })).toHaveAttribute("aria-pressed", "true");
  await roundFilter.getByRole("button", { name: "Show Final" }).click();
  await expect(page.getByRole("columnheader", { name: "Final" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Round of 32" })).toHaveCount(0);
  await expect(page.locator('[data-correct-knockout="true"]')).toHaveCount(0);
  const bracketScrollHint = page.getByText("Scroll horizontally to compare all knockout picks", { exact: true });
  if (isMobile) {
    await expect(bracketScrollHint).toBeVisible();
  } else {
    await expect(bracketScrollHint).toBeHidden();
  }

  await page.getByRole("tab", { name: "Schedule" }).click();
  const scheduleFilterHeading = page.getByRole("heading", { name: "Matches" });
  if (isMobile) {
    await expect(scheduleFilterHeading).toHaveCount(0);
  } else {
    await expect(scheduleFilterHeading).toBeVisible();
  }
  await expect(page.getByRole("group", { name: "Schedule match filter" }).getByRole("button").first()).toHaveCSS("min-height", "26px");
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
  const todayCard = page.getByRole("heading", { name: "Today" }).locator("../..");
  await todayCard.locator("tbody tr").first().click();
  await expect(page.getByRole("dialog")).toContainText("This game has not started yet");
  await page.getByRole("button", { name: "Close match details" }).click();

  await page.getByRole("tab", { name: "Leaderboard" }).click();
  const scoringRulesButton = page.getByRole("button", { name: "Show scoring rules" });
  if (isMobile) {
    await expect(scoringRulesButton).toHaveCount(0);
  } else {
    await scoringRulesButton.hover();
    await expect(page.getByRole("tooltip")).toContainText("50 points per exact current position");
  }
  await expect(page.getByRole("columnheader", { name: "Total" })).toBeVisible();
  expect(await page.getByRole("columnheader").allTextContents()).toEqual(
    isMobile
      ? ["Rank", "Participant", "Champion", "Total"]
      : ["Rank", "Participant", "Champion", "Group", "Knockout", "Total"],
  );
  if (isMobile) {
    const leaderboardTable = page.locator(".MuiTableContainer-root");
    const dimensions = await leaderboardTable.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});

test("keeps every dashboard section within the page viewport", async ({ page, isMobile }) => {
  await page.goto("/");

  for (const tab of ["Leaderboard", "Groups", "Knockout", "Schedule"]) {
    await page.getByRole("tab", { name: tab }).click();
    const tabHeading = page.getByRole("heading", { name: tab, exact: true });
    if (isMobile) {
      await expect(tabHeading).toHaveCount(0);
    } else {
      await expect(tabHeading).toBeVisible();
    }

    const dimensions = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  }
});
