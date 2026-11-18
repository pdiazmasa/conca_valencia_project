<p align="center">
  <img src="docs/sherpas-logo.png" alt="Sherpas" height="90">
  &nbsp;&nbsp;<b>×</b>&nbsp;&nbsp;
  <img src="docs/samepage-logo.png" alt="Same Page" height="90">
</p>

# Sherpas × Same Page

Sherpas x UPV Hackathon 2026. Challenge: "Bring the plan to life".

## Try it

- Video (2 min): https://youtu.be/0QUjZHNdYcQ?si=GTkhc50fLNQ-OlaR
- App (best on your phone): https://same-page-eight-mu.vercel.app

<img src="docs/qr-app.png" alt="QR code to open Same Page on your phone" width="160">

Scan the QR code with your phone to open the app. No sign up and nothing to install.

## The problem

Sherpas already gives every family a very complete financial plan. The problem is that a plan is useless if the family doesn't believe it, doesn't understand it or doesn't do anything with it. And in a couple, a lot of the time each one has a different idea of how their finances are going.

## What makes us different

1. We get the couple on the same page. Each one answers on their own and then the app shows you where you think the same, where you don't and what the plan really says.
2. Each person sees the plan in the format that works best for them. The same plan can be seen as a Wrapped, as a Dashboard, listened to as Audio or read as a Report.
3. It doesn't stop at showing you a score, at the end each one picks their first step and puts it in their calendar.

## Why it works

Before showing you your plan we ask you things about it. For example, at what age you think your savings run out. You answer what you think and then we show you what the plan says.

We don't do this just because. It's proven that when you get something wrong that you were very sure about, the mistake sticks with you and you correct it much better than other mistakes. It's called the hypercorrection effect, and Butterfield and Metcalfe studied it in 2001: https://doi.org/10.1037/0278-7393.27.6.1491

And every family has a surprise in their plan that clashes with what they believe about themselves:

- Samantha has an 82 out of 100, but her savings run out at 73.
- The Johnsons save $26,000 a year and none of it goes to retirement.
- The Weahs pay $300 on their card and only $30 actually lowers the debt.
- Michael runs out of savings at 85.

## How the app works, step by step

1. You pick who you are from the 4 test families.
2. If there are two adults, you answer in turns ("Timothy, it's your turn" and then Melanie).
3. The first question is your age. Depending on what you put you get one format or another: under 30, Wrapped; 30 to 54, Dashboard; 55 or more, Audio. Further down we explain why we ask it if we already know it.
4. You answer 3 or 4 questions taken from your own plan, with a slider.
5. A short loading screen.
6. If you are a couple, you go topic by topic seeing what each one thought, whether you agree and what the plan says.
7. You see your full plan in the format you got.
8. In "See it your way" you can see it in the other formats.
9. In "Your next steps" each one picks the step they would do first, sees how to do it and whether you agree. You can download a calendar reminder for 7 and 30 days later, and also print a sheet with everything.

## The formats

- **Wrapped:** cards like Instagram stories, that you swipe through. It has its own mode for couples. On a computer it looks like Instagram or Spotify Wrapped on PC: the story in the middle, arrows on the sides and the stories before and after small and blurred.
- **Dashboard:** charts in widgets, a bit like the iPhone ones. At the very top there is "The one thing to know", the most important thing in your plan. You also see your answers vs the plan, your score and how high it could go, and what each step adds. Each page has 4 widgets at most and the rest goes in "Details".
- **Audio:** it reads the questions and the results out loud.
- **Report:** a report like the ones an advisor would give you. It has a cover sheet with the date and who the family is, the score and the score by area, the steps that raise your score, your answers vs the plan, a table of contents and a chapter for each part of the plan. You can download it as a PDF.

## The questions

The questions come from each family's plan. Not every family gets the same ones.

- How many months could you live on the money you have saved?
- Out of every $X you pay on your card, how much actually lowers the debt?
- At what age do you think your savings run out?
- Out of every $100 you save, how much goes to retirement?
- If you weren't here, how many years of salary would your life insurance cover?
- What % of your investments is in stocks?
- If you maxed out your 401(k), how much less tax would you pay this year?

We don't use any AI to pick them. We use some rules, like a decision tree, that are in `scripts/build-families.mjs`. First the questions that don't make sense for that family are thrown out (for example, the card one if they don't have expensive card debt). Then each one gets a score based on how much that number stands out in their plan, and the ones that clash the most are kept.

## Considerations

There are things we made this way so it's easy to try in the hackathon, but in the real app they would be different.

### Age and picking a family

In the MVP you pick one of the 4 test families and the first thing the app asks is your age. But we already have each person's age, because it comes in the Sherpas plan.

We added the age question so the hackathon jury can see that the same information is told in different ways depending on age. If we took the age straight from the plan, each family would always see the same format and you wouldn't notice. That's why the age slider already starts at the age from the plan, but you can change it. That way you can put another age with the same family and see how the way the plan is shown changes. For couples we use the average of both ages.

The family list is also only there to make it easy to try. In the final product, both things would be replaced by a log in button. Each person logs in with their account, the app already knows who they are and their age, and shows them their format straight away.

### One phone per person

In the MVP the couple answers on the same phone, in turns.

In the final product each one would answer from their own phone. For that each person would have to log in with two-step verification (two-factor), because this is very private and sensitive information: nobody's financial data can leak, and each person has to be who they say they are and only see what's theirs.

### The audio

In the MVP the audio is generated beforehand with ElevenLabs and saved in the app. We did it this way so we don't have to put any token in the browser, because anyone who opened the website could see it and use it.

In the final product the audio would be generated for each person with their own data, calling ElevenLabs from a server, never from the browser.

### The questions

In the MVP the questions for the 4 families are made beforehand. In the final product they would be made for each new user, with the same rules from `scripts/build-families.mjs`: we look at which numbers in their plan stand out the most and ask about those, so they then find the clash between what they thought and reality.

### The database

We haven't connected any database because the MVP doesn't need one: everything comes from the Sherpas plan and is saved in some JSON files. For the log in of the final product we would need one, but a small one: just the user accounts and which Sherpas plan belongs to each one.

## Viability and scalability

For more people to use it you only need to grow the user database. There isn't much information to store, because Sherpas already has the financial data. The website itself is just files served as they are (right now on Vercel), so it handles lots of users without doing anything.

And money-wise, doing everything with API calls for each user would cost very little. We worked it out more or less like this:

| What | Approximate cost per user |
|---|---|
| Plan data (Sherpas MCP) | $0, it's Sherpas' |
| Picking the questions (rules, no AI) | $0 |
| ElevenLabs audio (about 3,000–4,000 characters per family, at about $0.05 per 1,000) | about $0.15–0.20 |
| Website (static files) | practically $0 |
| Total | less than $0.25 per user |

The audio numbers come from what it cost us: for the 4 families we generated 153 audio clips with about 10,900 characters in total. The ElevenLabs price is for their Flash v2.5 model (between $0.04 and $0.05 per 1,000 characters depending on the source).

To compare: a financial advisor in the United States charges about $300 an hour on average. Explaining the plan to a family in person, around 4 hours, would be about $1,200. With Same Page it's under $0.25, and on top of that the family can look at it whenever they want.

## How it's built

It's built in TypeScript, with React 18 for the screens and Vite 5 to run and build it. We didn't use any chart library, we made the charts by hand with SVG and HTML.

The APIs are only used beforehand, in the scripts, never while you use the app:

- The Sherpas MCP (with `@modelcontextprotocol/sdk`), to get each family's plan (`list_cases` and `get_case`).
- ElevenLabs through the Sherpas proxy, to generate the voices (model `eleven-flash-v2.5`).

### How the files connect

First there are some scripts that run only once, connect to the Sherpas MCP and save everything in files:

- `scripts/build-families.mjs` gets the families and their questions and saves them in `src/data/families.generated.json`.
- `scripts/build-analysis.mjs` gets the full analysis and saves it in `src/data/analysis.generated.json`.
- `scripts/build-audio.ts` generates the audio in `public/audio/` and the list of clips in `src/data/audio.manifest.json`.

After that the app doesn't call anything, it only reads those files:

- `src/data.ts` reads the JSON and formats the numbers nicely (it doesn't do any maths).
- `src/App.tsx` has the screens and their order: family, turns, age, questions, loading, plan and finale.
- `src/formats/` has one file per format (Wrapped, Audio and Report), and `src/dashboard/` has the Dashboard.
- `src/analysis/` is the couple part: what each one thought and what the plan says.
- `src/story/` makes the Wrapped look like stories, on phone and on PC.
- `src/finale/` is the "See it your way" screen and the family cards on PC.
- `src/NextSteps.tsx` is "Your next steps", and `src/reminders.ts` creates the calendar reminder.

## How to run it

```bash
npm install
npm run dev
```

And open http://localhost:5173.

There's also `npm run build` to build it and `npm run preview` to see the build.

## The Sherpas plans of the 4 families

These are the real plans that everything the app shows comes from:

- Timothy and Melanie Weah: https://app.sherpaswealth.com/plan/shared/RcCtgoNkGmD6dvGtYVKWLGefdCTFdc4JP_jH9Jbz2jo
- Michael Carter: https://app.sherpaswealth.com/plan/shared/ZshH0AUJjZnvwKIYtP5wYKyvI6Nc1nsGwQlDncXLfek
- Daniel and Emily Johnson: https://app.sherpaswealth.com/plan/shared/FjVPq_UEwSMxaye8aOWj3osJWWSE3cDnYWcxm1X7I78
- Samantha Lewis: https://app.sherpaswealth.com/plan/shared/vyV2h64-qSet-sJuwkAHxw-iUaYV88Lkwsg29L2Y5y8

## Team

Pedro Díaz Masa Valencia, Marta Pacha Alarcon and Marc Alonso Pascual. Universitat Politècnica de València.
