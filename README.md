# Oddfish

**Rare answers catch rare fish.** A daily trivia game: seven questions, twenty seconds each.
Every correct answer catches a creature, and the fewer players who give your answer, the
rarer and heavier the catch.

Live: https://optickbl.github.io/oddfish/

## Play locally

```bash
npm install
npm run dev        # http://localhost:5173/oddfish/
npm test           # core mechanics
npm run build      # production build in dist/
```

Pushing to `main` builds, tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## How it works

| Piece | Where |
| --- | --- |
| Tiers, thresholds, timer, reset time, share link | `src/config.ts` |
| Question bank, accepted answers, aliases, provisional estimates | `src/content/questions.ts` |
| Answer validation (normalising, aliases, plurals, small typos) | `src/core/answers.ts`, `src/core/validate.ts` |
| Rarity (real frequency after 200 answers, labelled estimates before) | `src/core/rarity.ts` |
| Daily schedule (same seven for everyone, reset 00:00 UTC) | `src/core/schedule.ts` |
| Daily Cast rules: deadline, one answer per question, Captain’s Wager | `src/core/game.ts` |
| Streaks, records, Logbook finds | `src/core/progress.ts` |
| Local vs online scoring | `src/services/engine.ts`, `src/services/supabase.ts` |
| Screens | `src/ui/views/*` |
| Artwork (all original SVG) | `src/ui/art.ts` |

### Rarity

Rarity is measured per question, per day: `players who gave this answer ÷ valid answers × 100`.
Thresholds: Sardine ≥ 30%, Clownfish ≥ 10%, Octopus ≥ 3%, Swordfish ≥ 1%, Leviathan < 1%.
Until a question has 200 valid answers, the curated estimate in `questions.ts` is used and the
game says “Estimated rarity”. Each catch stores the tier and weight it was awarded, so history
never changes later.

### Local mode (current)

Without a backend there is no shared answer data, so **every rarity shown is an estimate** and is
labelled that way. Progress is stored on the device (Profile → Back up progress to move it).
The daily reset uses the web server’s clock where it can, and the day never goes backwards.

## Online play (switch on later)

Online play adds email sign-in, server-side scoring and real player rarity.

1. Create a free project at supabase.com.
2. In the SQL editor, run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Authentication → Providers: keep Email on. Authentication → URL configuration: set the
   site URL to `https://optickbl.github.io/oddfish/`.
4. In the GitHub repo: Settings → Secrets and variables → Actions, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (Project settings → API). Re-run the deploy workflow.

The database decides everything that affects a score: answer matching, the 20-second deadline
(from the server’s own start time), rarity, weights, one wager per day, one answer per question
(idempotent), and a basic rate limit. Row-level security hides the answer list and other
players’ submissions; only aggregates for finished days and an opt-in leaderboard are public.
The SQL has been tested against Postgres 16; the app’s online client has not yet been run
against a live Supabase project.

## Adding questions

Add entries to `src/content/questions.ts` (see the format at the top), run `npm test`, then
`npm run seed:sql` and re-run `seed.sql` if online play is on. Rules of thumb: a closed set of
answers that can be checked reliably, answerable in 20 seconds, at least a dozen valid answers.

## Monetisation, prepared but not built

The Daily Cast stays free. Planned: Oddfish Plus (around €2.99/month: extra category casts,
more stats, cosmetics) and one-off cosmetics (boats, captain outfits, lanterns). Creatures,
rarity and the Captain’s Wager are never for sale, and nothing bought affects rankings.
