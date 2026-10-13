# 0012. The web app loads screens on demand and ships subset fonts

- Status: Accepted
- Date: 2026-10-13

## Context

The web app downloaded everything before the first screen: ~547 KiB of JavaScript (gzip) and
four Inter font files of ~340 KB each (~1.3 MB, not cached long-term). On a mid-range phone
over 4G the Overview took 5–6 s to appear. An earlier try at splitting was dropped because the
total of all files grew; what the person waits for is the first screen, not the total.

## Decision

- **Screens load on demand on the web.** Expo Router's async routes (`app.config.ts`,
  `asyncRoutes: { web: true }`): the page loads the framework and shared code (~440 KiB), then
  the open screen's file. Once the dashboard has shown and the browser is idle, the other main
  screens are fetched one at a time (`features/shell/prefetchScreens.web.ts`), so switching
  is still instant. Phones are unchanged: everything ships inside the app.
- **Subset WOFF2 fonts on the web.** Inter cut to Latin, punctuation, arrows and ₹
  (`assets/fonts`, ~21 KB per weight; `scripts/subset-fonts.sh` rebuilds them, licence
  `assets/fonts/OFL.txt`). Other scripts (Tamil in a note, say) use the device's font. Phones
  keep the full TTFs.
- **Hashed files are cached for a year** (`/_expo/static` and `/assets` in `vercel.json`), and
  missing ones return 404 instead of the dashboard page.
- **After a new deploy**, a tab left open asks for screen files that no longer exist. The error
  screen (`features/shell/UpdateErrorBoundary.tsx`) reloads once to pick up the new version,
  but never offline or while changes wait to be saved; it then offers Retry.
- **The size check measures the first load** (scripts in the page, ceiling 450 KiB) and all
  files together (ceiling 590 KiB).

## Consequences

- Measured on a 4× slower CPU with 9 Mbps and 60 ms latency (local, uncompressed): the
  Overview shows in ~3.8 s instead of 5–6 s; JavaScript 547 → 477 KiB before the Overview,
  fonts 662 → 83 KiB.
- All files together grow a little (~571 KiB), because splitting repeats some shared code.
- The framework (Expo Router, React Native Web, React DOM) is ~280 KiB of the first load and is
  the floor; the 350 KiB target needs a lighter framework, not more splitting. Expo's
  experimental tree shaking saved only ~10 KiB and was not adopted.
- New screens should stay route files so they keep loading on demand.
