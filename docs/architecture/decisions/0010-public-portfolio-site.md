# 0010. A separate public portfolio site, edited in the dashboard and published as a snapshot

- Status: Accepted; where it is served: superseded by [0011](0011-portfolio-at-the-dashboard-address.md)
- Date: 2026-10-11

## Context

The owner wants a public developer portfolio (hero, skills, projects with case studies,
experience, credentials, contact) whose content is managed entirely from the private dashboard,
with changes going live without a redeploy. The dashboard holds personal finance data behind
two-step sign-in. The portfolio is read by anyone, must be found by search engines, should look
right before any script runs, and takes input from strangers (the contact form). An earlier
public portfolio table from the old app was deleted with its data (ADR 0008).

## Decision

- **Its own app and origin.** `apps/portfolio` is a small Vite + React site deployed as a second
  Vercel project. It shares nothing in the browser with the dashboard (a different origin), so a
  fault on the public site cannot reach the dashboard's session. It has no sign-in.
- **Rendered on the server.** A Vercel function renders each page to HTML with its meta tags,
  social preview, JSON-LD, sitemap and robots, then hydrates. The CSP is set per response
  (scripts from the site only, plus the hash of one small inline script).
- **Edited in the dashboard, saved through the database.** Dashboard → Portfolio edits a
  working copy in Supabase: one table per kind of content (links, numbers and highlights, skill
  areas and skills, projects, experience, education, extra sections) plus a profile. Each change
  is saved at once by `portfolio_save`, which accepts only the listed columns for that kind; the
  tables use the same template as the ledger (own rows only, two-step sign-in, a check for every
  rule, audit by column name). Items can be drafts (`visible` off), reordered and deleted.
- **Published as a snapshot.** `portfolio_publish()` stores one JSON document per owner in
  `portfolio_publications`. A trigger builds it on the server from the visible items (anything
  the request sends is replaced). Visitors read only that snapshot through
  `portfolio_public(handle)`, the one function the public role may call besides the contact form
  and previews. Nothing a visitor sees changes until the owner publishes; pages are cached for 60
  seconds, so a publish shows within about a minute with no redeploy.
- **Private previews.** `portfolio_preview_token()` stores a snapshot of the working copy, drafts
  included, behind a random link valid for 20 minutes. Only the token's hash is stored; preview
  pages are `noindex`, not cached and send no referrer.
- **Contact form without a mail provider.** `portfolio_contact` checks the fields on the server,
  stores the message for the owner (shown under Messages in the dashboard) and limits sending by
  a salted hash of the visitor's IP (3 per 10 minutes, 10 per day) and 100 messages a day per
  owner. A hidden field and a minimum fill time drop simple bots without telling them. No email
  is sent and the IP itself is never stored.
- **Media in Storage.** Images and the résumé PDF go to the public `portfolio-media` bucket under
  the owner's id: 5 MB, images and PDF only, random names, never overwritten, writes only by the
  owner with two-step sign-in. The web dashboard resizes images to WebP (1600 px and a 640 px
  copy) before upload. After each publish, files nothing uses (drafts and the live site
  included) and older than an hour are deleted.
- **Motion without a library.** CSS transitions, IntersectionObserver, one canvas and View
  Transitions where the browser has them. Everything is visible without JavaScript, and reduced
  motion turns the effects off.

## Consequences

- Two Vercel projects to configure. The portfolio's settings are server-side variables, and only
  public-by-design values (Supabase URL, publishable key, handle, site address).
- Three `security definer` functions are reachable without signing in (`portfolio_public`,
  `portfolio_preview`, `portfolio_contact`). They are kept small and read or write one table each.
  Everything the owner does goes through `security invoker` functions under Row Level Security.
- The contact limits rely on the client IP header Supabase's network sets and on a time the
  browser reports. Determined spam can still get through, bounded by the daily cap. Email
  notification would need an Edge Function and a mail provider (not added).
- Proficiency levels are optional and off by default: the site shows a level only when one is
  entered, never a made-up percentage.
- Images and the résumé PDF are added from the web dashboard. The phone apps can pick images
  (not yet tried on a device) but not PDFs.
- Content is limited by the same checks in three places: the dashboard form (clear messages),
  the database (the boundary) and the site's parser (defensive rendering).
