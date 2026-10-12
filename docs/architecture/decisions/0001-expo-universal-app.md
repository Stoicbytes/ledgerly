# 0001. One Expo codebase for web, iOS and Android

- Status: Accepted
- Date: 2026-10-07

## Context

The owner uses the app on a phone and on a laptop. The first version was a Vite web app; a
second, native code base would double the work for one person's app.

## Decision

Build one Expo SDK app with Expo Router and React Native Web: static web export on Vercel today,
EAS builds for iOS and Android later. Prefer Expo modules; add a library only when it pays for
itself on every platform (bundle size is checked in CI).

## Consequences

- One set of screens, rules and tests for every platform; phone layouts are designed, not
  shrunk.
- React Native Web limits some web-only polish, and the web bundle is framework-heavy (route-level
  code splitting is planned to reach the 350 KiB target).
- Native-only features (biometric lock, widgets, health data) become small additions later.
