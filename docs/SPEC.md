# Hubris extension spec (overnight 2026-11-17)

This spec drives the build of `apps/extension` on top of `packages/core` and `packages/types`.
Kesh's own scoring note is the source of truth; this file restates it in plain words.

## Scope

Build a Chrome extension (Manifest V3) that tracks weekly activities in three categories: Career, Health, and Hobbies.
The user creates activities, each with a weekly frequency goal ("5 times a week") and an importance (High, Medium, Low).
The user logs each time they do an activity, and the extension shows this week's score per activity, per category, and overall.
The extension shows today's view (the week-to-date score) and a trend view (the last 8 weeks, plus a log heatmap).
A history view lists past logs by day, and each log can be deleted (with undo right after logging).
A first-run onboarding offers Kesh's example activities (Leetcode and Classes) or a blank start.
A settings view edits, archives, restores, and deletes activities, and holds import, export, and erase-all-data.
Every screen has an empty state and a clear error state, and the UI is keyboard and screen-reader usable.
All data stays on the device in IndexedDB, and the user can export it to a JSON file and import it back.
A GitHub Actions workflow runs lint, type-check, tests, and the build, and the build produces an installable zip.
The extension makes no network calls, has no analytics, and holds no secrets.
Entertainment is out of scope: Kesh's note stops at "Movies:", so its design is his decision.
The code keeps a clearly marked extension point named `ENTERTAINMENT_EXTENSION_POINT` where Entertainment would plug in.
The Expo mobile app is out of scope and is not modified.

## Scoring rules (from Kesh's note)

An activity's score is `(times done this week / weekly goal) * 100`.
Within a category, activities are grouped by importance, and the category score is 40% High, 35% Medium, and 25% Low.
The same priority weights apply to every category.
The overall score is `36% Career + 36% Health + 28% Hobbies`, on a 0 to 100 scale.
Entertainment is not part of the overall score.

## Decisions where the note is silent

Each decision below is one named constant or function in `packages/core/src/weighted-score.ts`, so Kesh can change it in one place.

1. Activity score cap: an activity score is capped at 100 (`ACTIVITY_SCORE_CAP`), so doing Leetcode 7 times against a goal of 5 scores 100, not 140.
   Reason: the overall score is described as "out of a 100%", and the existing `calculateFrequencyScore` in `packages/core/src/scoring.ts` and the mobile app both cap at 100.
2. Several activities with the same importance: their scores are averaged, and the average takes that importance's weight.
3. A category with no activity of some importance (`EMPTY_PRIORITY_POLICY = 'renormalize'`): the weights of the importances that are present are rescaled to sum to 100%.
   Reason: Kesh's own example has only a High and a Medium activity, and under a fixed 25% Low share it could never score above 75.
   The mobile app (`apps/mobile/src/hooks/useStats.ts`) does the same; setting the policy to `'zero'` gives the strict fixed-weight reading.
4. A category with no activities at all (`EMPTY_CATEGORY_POLICY = 'zero'`): it contributes 0 to the overall score, the literal reading of "36% career + 36% health + 28% hobbies".
   The UI shows such a category as "No activities yet" so the low overall score is explained.
5. The week runs Monday 00:00 to Sunday 23:59:59.999 in local time, reusing `getPeriodBoundaries('weekly')` from `packages/core/src/scoring.ts`.
6. One log entry counts as one time done.
7. Archived activities are left out of the score; their logs are kept.
8. Scores keep full precision in `packages/core`; the UI rounds to whole numbers only for display.
9. An activity counts from the week it was created; goal, importance and category edits apply to every week because the app keeps no revision history.

## Worked examples (each one is a unit test in `packages/core`)

Example A is Kesh's own example from his note.
Career has Leetcode (goal 5 a week, High, done 3) and Classes (goal 4 a week, Medium, done 2).
Leetcode scores (3/5) * 100 = 60 and Classes scores (2/4) * 100 = 50.
With renormalization the Career score is (0.40 * 60 + 0.35 * 50) / (0.40 + 0.35) = 41.5 / 0.75 = 55.333... (exactly 166/3).
With the `'zero'` policy the Career score is 0.40 * 60 + 0.35 * 50 = 41.5.

Example B adds Health and Hobbies to Example A and computes the overall score.
Health has Gym (goal 3, High, done 3) = 100, Sleep by 11pm (goal 7, Medium, done 7) = 100, and Stretching (goal 2, Low, done 1) = 50.
The Health score is 0.40 * 100 + 0.35 * 100 + 0.25 * 50 = 87.5.
Hobbies has Guitar (goal 3, Medium, done 1) = 33.333... and Reading (goal 4, Low, done 4) = 100.
The Hobbies score is (0.35 * 33.333... + 0.25 * 100) / (0.35 + 0.25) = 36.666... / 0.6 = 61.111... (exactly 550/9).
The overall score is 0.36 * 55.333... + 0.36 * 87.5 + 0.28 * 61.111... = 19.92 + 31.5 + 17.111... = 68.531... (exactly 30839/450), shown as 69.

Example C covers the cap and two activities of the same importance.
Career has Leetcode (goal 5, High, done 7) capped to 100, System design (goal 2, High, done 1) = 50, and Classes (goal 4, Medium, done 4) = 100.
The High average is (100 + 50) / 2 = 75.
The Career score is (0.40 * 75 + 0.35 * 100) / 0.75 = 65 / 0.75 = 86.666... (exactly 260/3).

Example D covers an empty category.
With Career and Hobbies from Example B and no Health activities, the overall score is 0.36 * 55.333... + 0 + 0.28 * 61.111... = 37.031... (exactly 8332/225).

## Data model (`packages/types`)

`Importance` is `'high' | 'medium' | 'low'`.
`ScoredCategory` is `'career' | 'health' | 'hobbies-habits'`, matching the category ids already used by `packages/types` and the mobile app.
`TrackedActivity` has `id`, `name`, `category: ScoredCategory`, `timesPerWeek` (integer from 1 to 99), `importance`, `archived` (boolean), `createdAt`, and `updatedAt` (ISO strings).
`ActivityLog` has `id`, `activityId`, `loggedAt` (ISO string), and an optional `note`.
`HubrisExport` is `{ app: 'hubris', schemaVersion: 1, exportedAt, activities, logs }`.

## Modules

`packages/core/src/weighted-score.ts` holds the weights, the policies, and these pure functions: `activityScore`, `categoryScore`, `overallScore`, `computeWeeklyReport`, and `computeWeeklyTrend`.
`computeWeeklyReport(activities, logs, referenceDate)` returns the week bounds, the overall score, and per category the score (or `null` when empty) and one row per activity with goal, done, and score.
`computeWeeklyTrend(activities, logs, referenceDate, weeks = 8)` returns one weekly report summary per week, oldest first, ending with the current week.
`apps/extension/public/manifest.json` declares a popup, a side panel, and a module service worker, with only the `sidePanel` and `alarms` permissions and no host permissions.
`apps/extension/src/storage/` holds the IndexedDB repository (activities and logs stores) and the JSON import and export with schema validation.
`apps/extension/src/background/` holds the service worker, which keeps the toolbar badge showing this week's overall score.
`apps/extension/src/state/` holds the React hook that the UI uses to read data and run actions.
`apps/extension/src/ui/` holds the screens and components for the popup and the side panel.

## Test plan

`packages/core` has Vitest unit tests for Examples A to D, the cap, the week bounds, and the trend.
`apps/extension` has Vitest tests for the repository (with `fake-indexeddb`), for import and export round trips and rejection of bad files, and component tests for the main screens.
An end-to-end script loads the built unpacked extension in Playwright's own Chromium, checks there are no console errors, and saves screenshots to `docs/screenshots/`.
`pnpm` lint, type-check, test, and production build all pass for `packages/core`, `packages/types`, and `apps/extension`.
