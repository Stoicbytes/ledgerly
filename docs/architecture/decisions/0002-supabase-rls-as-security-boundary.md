# 0002. Supabase, with RLS and constraints as the security boundary

- Status: Accepted
- Date: 2026-10-07

## Context

The app holds personal financial data. A browser app can be inspected and modified by anyone who
has it, so nothing the client does can be trusted.

## Decision

Use Supabase (Auth, Postgres, Edge Functions). The client gets only the publishable key. Every
user-owned table has forced RLS with per-verb policies, a restrictive two-step-sign-in (aal2)
policy, composite foreign keys that tie references to the owner, CHECK constraints and triggers
for every business rule, and audit entries without values. RPCs run as the caller
(`security invoker`). Anything needing a secret runs in an Edge Function.

## Consequences

- A bug or tampering in the client can at worst affect the user's own rows, and only within the
  rules the database allows.
- Rules exist twice (domain code for instant feedback, SQL for enforcement) and must be kept in
  step; tests cover both sides.
- Schema changes go through reviewed SQL migrations.
