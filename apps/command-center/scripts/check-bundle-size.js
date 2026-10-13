#!/usr/bin/env node
/**
 * Fails CI when the gzipped web JavaScript grows past the regression ceiling.
 * Phase 1 baseline: ~476 KiB gzip (framework-dominated: expo-router, reanimated,
 * react-native-web, react-dom). The 2026 UI redesign added ~25 KiB of app code,
 * so the ceiling moved 500 → 520 KiB. Replacing Reanimated (~140 KiB gzip on web)
 * with React Native's built-in Animated brought the bundle to ~380 KiB, so the
 * ceiling dropped to 430 KiB: room for the rest of the expense manager, not
 * for regressions. Phase 2.1 added Supabase Auth: first the whole supabase-js
 * (~70 KiB gzip), then only @supabase/auth-js (~35 KiB less, no unused realtime or
 * storage clients). With people, photos and Notes the bundle is ~450 KiB, so the
 * ceiling is 470 KiB. Mutual funds and stocks on real data (holdings, trades, SIPs,
 * FIFO gains, XIRR, AMFI search, five forms) added ~20 KiB: the bundle is ~480 KiB and
 * the ceiling 495 KiB. The Portfolio editor (content for the public site: eight kinds
 * of items with one schema-driven form, uploads, reorder, preview and publish) added
 * enough to pass that: the bundle is ~506 KiB and the ceiling 520 KiB. The October 2026
 * expense and fund extras (recurring entries, search and CSV export, the amount
 * calculator, capital gains, goals, costs, SIP step-up) brought it to ~521 KiB, so the
 * ceiling is 540 KiB; Expo Router's async routes were tried and made the total larger
 * (shared code is duplicated per route), so splitting needs its own piece of work. Salary &
 * PF (payslips across employers, the PF passbook with interest estimates) and the full JSON
 * export added ~12.6 KiB: the bundle is ~540 KiB and the ceiling 560 KiB. Phase 11
 * target from the plan: ≤ 350 KiB (route-level code splitting). Raise the ceiling only
 * deliberately, in the same PR that explains why.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CEILING_KIB = 560;
const TARGET_KIB = 350;
// npm scripts run from the package root.
const dir = path.join(process.cwd(), 'dist', '_expo', 'static', 'js', 'web');

if (!fs.existsSync(dir)) {
  console.error(`No web bundle found in ${dir}. Run "npm run build:web" first.`);
  process.exit(1);
}

let total = 0;
for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.js'))) {
  const size = zlib.gzipSync(fs.readFileSync(path.join(dir, file)), { level: 9 }).length;
  total += size;
  console.log(`${file}: ${(size / 1024).toFixed(1)} KiB gzip`);
}
const kib = total / 1024;
console.log(
  `Total: ${kib.toFixed(1)} KiB gzip (ceiling ${CEILING_KIB} KiB, target ${TARGET_KIB} KiB)`,
);
if (kib > CEILING_KIB) {
  console.error('Web bundle exceeds the regression ceiling.');
  process.exit(1);
}
