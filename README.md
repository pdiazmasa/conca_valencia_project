# Same Page

Same Page is a mobile-first web app where a family guesses key numbers in their financial plan on one shared phone, sees the gap against their real plan on a lifeline, and agrees on a first step with a target date. Every displayed financial value is precomputed and loaded from family JSON files without client-side financial calculations.

## How to run

```bash
npm install
npm run dev
npm test
npm run check:numbers
npm run build
```

## Data status

All four family datasets (`weah.json`, `lewis.json`, `carter.json`, `johnson.json`) currently contain **demo data pending verification** against the Sherpas MCP (`"verified": false`).

## Folder structure

```text
scripts/
  check-numbers.mjs      # CLI runner for the number & fact guard
  numberGuard.mjs        # Shared validation logic for displayed numbers and placeholders
src/
  components/            # Lifeline SVG, AnswerSlider, ListenButton
  data/
    families/            # Family JSON files (weah, lewis, carter, johnson)
    index.ts             # Family registry
    types.ts             # TypeScript types for families and sessions
    numbers.test.ts      # Vitest guard test
  screens/               # 8 screens of the single-phone state machine
  utils/                 # Formatting, lifeline math, plan logic, dates, speech, storage
  App.tsx                # State machine and session persistence
  styles.css             # CSS custom properties, mobile-first accessible styling, print CSS
```
