# Same Page

Web application for the Sherpas hackathon (React 18 + Vite + TS). A family guesses key numbers from their financial plan using a slider and discovers the real value through an interactive reveal format to get their expectations and reality on the same page.

## Getting started

```bash
npm install
npm run dev
```

### Regenerating precomputed data

The application does not perform financial calculations at runtime; it consumes `src/data/families.generated.json` exclusively.

1. Copy `.env.example` to `.env`.
2. Get your token at https://mcp-hackathon.sherpaswealth.com/personal-token (valid for 72 hours) and set it as `SHERPAS_MCP_TOKEN`.
3. Check the connection to the MCP server:
   ```bash
   npm run diagnose:mcp
   ```
4. Regenerate the data JSON:
   ```bash
   npm run build:families
   ```
   *(Optional: `--source=files <path/to/cases>` to build from local JSON files).*

## Screen flow

1. **Family**: Select the case or family to start the session.
2. **Quiz (`quiz`) & Format (`format`)**: 3 quick questions assign the best reveal format (*Straight*, *Story*, *Future you*, or *Visual*).
3. **Question (`ask`)**: The family answers a probe by adjusting a slider based on their gut instinct.
4. **Reveal (`reveal`)**: Interactive reveal where their guess meets the real number from their plan with plain-English context.
5. **Summary (`done`)**: Final comparison of gut feeling vs. reality across all probes, plus a gallery to explore the other formats.

## Financial probes

Probes are deduced and prioritized in `scripts/build-families.mjs` based on each household's profile:

| ID | Question | What it compares |
|---|---|---|
| `colchon` | How many months could you live off your cash? | Months of cash coverage vs. the recommended range (min/max). |
| `tarjeta` | For every $X you pay on your credit card, how much reduces your debt? | Principal reduction vs. cost absorbed by revolving interest (APR > 15%). |
| `ahorros` | At what age do you think your savings would run out? | Estimated depletion age vs. projected liquid assets at the end of the plan. |
| `destino` | For every $100 you save, how much goes toward retirement? | Share of annual savings going toward retirement (< 25% triggers alert). |
| `seguro` | If you weren't here, how many years of salary would your life insurance cover? | Years of income covered vs. Sherpas recommended minimum. |
| `mezcla` | What % of your investments is in stocks? | Actual equity allocation vs. the target for their risk profile. |
| `fiscal` | If you maxed out your 401(k), how much less would you pay in taxes this year? | Estimated annual tax reduction from maxing out 401(k) contributions. |
| `orden` | (Pending) | Cascading prioritization of goals and debts. |

## Project structure

```text
├── scripts/
│   └── build-families.mjs        # MCP/file extraction and probe precalculation
├── src/
│   ├── charts/                   # Chart components and visualizations
│   │   ├── charts.css            # Rail, line chart, and badge styles
│   │   ├── ChartsLab.tsx         # Dev-only chart playground (/#charts)
│   │   ├── config.ts             # Reference bands and ticks per probe
│   │   ├── LineChart.tsx         # Interactive asset projection line chart
│   │   ├── Rail.tsx              # Interactive track comparing guess vs. plan
│   │   └── useTween.ts           # Numeric interpolation and animation hook
│   ├── data/
│   │   └── families.generated.json # Precomputed data ready for the client
│   ├── formats/                  # Reveal formats (Straight, Story, Future you, Visual)
│   ├── App.tsx                   # Navigation state and screens
│   ├── data.ts                   # TypeScript types, JSON loader, and formatters
│   ├── main.tsx                  # React entry point
│   └── styles.css                # Design tokens (:root) and global rules
├── .env.example
├── package.json
└── vite.config.ts
```

## Architecture rule

The application performs zero financial calculations on the client. All quantitative logic, thresholds, and probe selection are resolved exclusively in `scripts/build-families.mjs`.
