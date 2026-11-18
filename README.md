# Same Page

Sherpas x UPV Hackathon 2026. Challenge: "Bring the plan to life".

Demo: https://same-page-eight-mu.vercel.app

## What it is

Same Page is a web app made mainly for the phone. The idea is that a family understands their Sherpas financial plan and, when they finish, actually does something with it.

Before showing you your plan, we ask you a few things about it. For example, at what age you think your savings will run out. You answer what you think, and then we show you what the plan really says. When your answer is nothing like reality, it sticks with you much more.

If there are two adults in the house, each one answers on their own, on the same phone, taking turns. Then the app shows you where you think the same and where you don't.

At the end, each person picks a first step to take and can add it to their calendar.

## Why we think it works

- Guess before you see. If you get it wrong, and on top of that you were very sure, you remember it. You remember the mistake you made, so you act more aware of it afterwards.
- Every family has a surprise in their plan that clashes with what they believe about themselves:
  - Samantha scores 82 out of 100, but her savings run out at 73.
  - The Johnsons save $26,000 a year and none of it goes to retirement.
  - The Weahs pay $300 on their card and only $30 of it lowers the debt.
  - Michael's savings run out at 85.
- Not everyone likes to see things the same way. That's why the same plan can be seen in different ways.
- It doesn't end with a score, it ends with something to do.

## How the app works, step by step

1. You pick who you are from the 4 test families.
2. If there are two adults, you answer in turns ("Timothy, it's your turn" and then Melanie).
3. The first question is your age. Depending on what you put, you get one format or another: under 30, Wrapped; 30 to 54, Dashboard; 55 or over, Audio. Further down we explain why we ask for it if we already know it.
4. You answer 3 or 4 questions taken from your own plan, using a slider.
5. A short loading screen.
6. If you're a couple, you go topic by topic seeing what each of you thought, whether you agree and what the plan says.
7. You see your full plan in the format you got.
8. In "See it your way" you can see it in the other formats.
9. In "Your next steps" each person picks the step they would do first, sees how to do it and whether you agree. You can download a calendar reminder for day 7 and day 30, and also print a sheet with everything.

## What is only for the MVP and how it would be in the final product

There are some things we built a certain way so they can be tried out at the hackathon, but in the real app they would be different.

### From picking a family and entering your age, to logging in

In the MVP you pick one of the 4 test families and the first thing the app asks you is your age. But we already have each person's age, because it comes in the Sherpas plan.

We added the age question so the hackathon judges can see that the same information is told in different ways depending on age. If we took the age straight from the plan, each family would always see the same format and you wouldn't notice. That's why the age slider already starts at the age from the plan, but you can change it. This way you can put a different age with the same family and see how the way the plan is shown changes. For couples, the average of both ages is used.

In the final product, both things would be replaced by a log in button. You sign in with your account, the app already knows who you are and your age, and shows you your format straight away.

### From pre-made audio, to audio with ElevenLabs

In the MVP the audio clips are generated beforehand and stored in the app. We did it this way so we don't have to put any token in the browser, because anyone opening the website could see it and use it.

In the final product the audio would be generated on the spot by calling ElevenLabs, for each person and with their own data. That call would be made from a server, not from the browser.

### From one phone for the couple, to one phone each

In the MVP the couple answers on the same phone, taking turns.

In the final product each person could answer from their own phone at the same time. For that, each person would need a strong login, because this is very private and sensitive information: everyone has to be who they say they are and only see what's theirs.

## The formats

- **Wrapped:** Instagram stories style cards that you swipe through. It has its own mode for couples.
- **Dashboard:** charts in widgets, a bit like the iPhone ones. At the very top there's "The one thing to know", the most important thing in your plan. You also see your answers compared to the plan, your score and how high it could go, and what each step adds. Each page has at most 4 widgets and the rest goes into "Details".
- **Audio:** it reads the questions and the results out loud.
- **Report:** a good old written report.

## The questions

The questions come from each family's plan and are chosen in `scripts/build-families.mjs`. Not every family gets the same ones.

- How many months could you live on the money you have saved?
- For every $X you pay on your card, how much actually lowers the debt?
- At what age do you think your savings run out?
- For every $100 you save, how much goes to retirement?
- If you weren't here, how many years of salary would your life insurance cover?
- What % of your investments is in stocks?
- If you maxed out your 401(k), how much less tax would you pay this year?

## Things we were clear about

- The app doesn't do any maths. All the numbers come from the Sherpas plan through their MCP. Some scripts get them beforehand and save them in `src/data/*.generated.json`, and the app only shows them. We don't make up any figure.
- While you use the app, no API is called: not the MCP, not any AI, nothing for voice. The audio clips were recorded beforehand with `scripts/build-audio.ts` and are in `public/audio/`. The app picks the clip based on the result, it never reads your answers out loud.
- We don't use any charts library, we made them ourselves in React.

## How to run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

There's also `npm run build` to build it and `npm run preview` to see the build.

## Folders

```text
scripts/          Get the data from the Sherpas MCP and prepare the questions, analysis and audio
public/audio/     The pre-recorded audio clips
src/
  App.tsx         The screens and how you move from one to another
  data.ts         Types and data loading (no maths)
  LoadingScreen.tsx
  NextSteps.tsx   Your next steps
  reminders.ts    The calendar reminder (.ics)
  formats/        Wrapped, Audio and Report
  dashboard/      The Dashboard
  story/          The stories bar for Wrapped on mobile
  analysis/       Analysis pieces and the couple part
  finale/         The "See it your way" screen
  lifeline/       Life line
  audio/          The narrator
  charts/         Line charts
  brand/          Logo and intro animation
  data/           The generated JSON files
```

## Team

Pedro Díaz Masa Valencia, Marta Pacha Alarcon and Marc Alonso Pascual. Universitat Politècnica de València.
