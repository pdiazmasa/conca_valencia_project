# Same Page

**Close the gap between what a family believes and what their Sherpas plan says.**

Sherpas x UPV Hackathon 2026 · Challenge: "Bring the plan to life"

Live demo: https://same-page-eight-mu.vercel.app

## What it is

A mobile-first web app. A household opens its plan, guesses a few key numbers *before* seeing them, and then discovers what the plan really says, told in the format that suits each person. When there are two adults, each one answers in turn on the same phone, and the app shows where they agree and where they see things differently. It ends with a first step for each person and reminders in their calendar.

## Why it works

- **Guess before you see.** Predicting a number and then seeing the real one makes it stick, especially when the guess was confidently wrong.
- **Every plan hides a twist** that contradicts what the family believes about itself:
  - Samantha scores 82 out of 100, yet her savings run out at 73.
  - The Johnsons save $26,000 a year, and $0 of it goes to retirement.
  - The Weahs pay $300 on their card, and only $30 of it reduces the debt.
  - Michael's savings run out at 85.
- **Same facts, told your way.** A recap for some people, a dashboard for others, a voice for others.
- **It ends in a decision**, not in a score.

## Screen flow

1. **Who are you?** Pick one of the four demo households (in production, this would be a login).
2. **Turns.** In households with two adults, each adult answers in turn ("Timothy, it's your turn"), sharing one phone.
3. **Age.** Sets the default format: under 30 gets Wrapped, 30–54 gets Dashboard, 55+ gets Audio.
4. **Guess.** Three or four questions taken from the household's own plan, answered with a slider.
5. **Loading.** A short "reading your plan" moment.
6. **Together** (two adults only). Topic by topic: what each person thought, whether they agree, and what the plan says.
7. **Your plan.** The full analysis in the chosen format.
8. **See it your way.** The same plan in the other formats, plus "Your next steps".
9. **Your next steps.** Each person picks the step from their own plan that they would do first, sees how to do it, and sees whether they agree. They add reminders for day 7 and day 30 to their calendar (an `.ics` file generated in the browser), and can print a one-page sheet.

## Formats

| Format | Default for | What it shows |
|---|---|---|
| **Wrapped** | Under 30 | Swipeable story cards, an animated intro, and a couple flow with per-question comparison and a shared-view summary. |
| **Dashboard** | 30–54 | "The one thing to know" about the plan, your guesses versus the plan, your score and how high it could go, score by area, and what each step adds. Each page shows at most four widgets, with a detail view for the rest. |
| **Audio** | 55+ | Questions and results read aloud with pre-generated voice clips. |
| **Report** | Anyone | A plain written report. |
| **Life line** (preview) | — | Your timeline in Christmases: how many more you pay a card, or when savings run out. Open `/lifeline.html`. |

## The questions

Questions are chosen and ranked per household in `scripts/build-families.mjs`, from its own plan.

| ID | Question | Compares |
|---|---|---|
| `colchon` | How many months could you live off your cash? | Months of cash versus the recommended range. |
| `tarjeta` | For every $X you pay on your credit card, how much reduces your debt? | Principal versus interest at the card's APR. |
| `ahorros` | At what age do you think your savings would run out? | Projected depletion age versus end of plan. |
| `destino` | For every $100 you save, how much goes toward retirement? | Share of yearly savings going to retirement. |
| `seguro` | If you weren't here, how many years of salary would your life insurance cover? | Coverage versus the recommended minimum. |
| `mezcla` | What % of your investments is in stocks? | Actual equity share versus the target for the risk profile. |
| `fiscal` | If you maxed out your 401(k), how much less would you pay in taxes this year? | Estimated tax reduction. |

## Architecture rules

- **No financial calculations in the browser.** Every figure comes from the household's Sherpas plan through the Sherpas MCP. Scripts precompute it into JSON (`src/data/*.generated.json`); the app only reads and displays it. The app invents no numbers.
- **No API calls while the app runs.** No MCP, no language model and no text-to-speech at runtime. Voice clips are generated ahead of time (`scripts/build-audio.ts`, 124 clips in `public/audio/`) and the app picks a clip by outcome, never by reading the user's own answers.
- **No charting library.** Charts are hand-written SVG and HTML in React.
- **In production**, the clips would be generated per user through the API, and both partners could answer on their own phones at the same time.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173.

Other scripts: `npm run build` (type-check and production build) and `npm run preview`.

### Regenerating the precomputed data (optional)

1. Copy `.env.example` to `.env` and set `SHERPAS_MCP_TOKEN`. Get a personal token at https://mcp-hackathon.sherpaswealth.com/personal-token (valid for 72 hours).
2. `npm run diagnose:mcp` checks the connection.
3. `npm run build:families` rebuilds the questions for each household.
4. `npm run build:analysis` rebuilds the full analysis for each household.
5. `npm run build:audio -- --dry-run` counts the clips without calling the API; `npm run build:audio` generates the missing ones into `public/audio/`.

## Project structure

```text
scripts/            Data extraction from the Sherpas MCP and precomputation (questions, analysis, audio)
public/audio/       Pre-generated voice clips
src/
  App.tsx           Screens and navigation
  data.ts           Types, data loaders and formatters (no financial maths)
  LoadingScreen.tsx
  NextSteps.tsx     Your next steps (first step per person, reminders, printable sheet)
  reminders.ts      Calendar file (.ics) generated in the browser
  formats/          Wrapped, Dashboard, Audio and Report
  dashboard/        Dashboard pages, widgets and SVG charts
  analysis/         Shared analysis blocks and couple reveal
  finale/           "See it your way" format chooser
  lifeline/         Life line format (preview at /lifeline.html)
  audio/            Narrator
  charts/           Line chart and rail
  brand/            Logo and intro animation
  data/             Generated JSON
```

## Team

Pedro, Marta and Marc. Universitat Politècnica de València.
