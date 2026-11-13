import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

function revealPlanAndAdvance() {
  expect(screen.getByText("Here is what you guessed.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show what your plan says" }));
  act(() => {
    vi.advanceTimersByTime(750);
  });
}

describe("Same Page end-to-end flows and new behaviors", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("blocks Continue while slider is untouched and supports Less/More buttons", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByRole("button", { name: "I'm Timothy, start" }));

    // Initially slider is untouched and Continue is disabled
    expect(screen.getByText("Move the slider")).toBeInTheDocument();
    const continueBtn = screen.getByRole("button", { name: "Continue" });
    expect(continueBtn).toBeDisabled();
    expect(
      screen.getByText("Move the slider and pick how sure you are to continue.")
    ).toBeInTheDocument();

    // Picking confidence alone still blocks Continue
    fireEvent.click(screen.getByRole("button", { name: "Very sure" }));
    expect(continueBtn).toBeDisabled();
    expect(
      screen.getByText("Move the slider to your guess to continue.")
    ).toBeInTheDocument();

    // First press of More sets value to scale min ($0), second press steps by $60
    const moreBtn = screen.getByRole("button", { name: "More" });
    const lessBtn = screen.getByRole("button", { name: "Less" });
    fireEvent.click(moreBtn);
    expect(screen.getByText("$0 a year")).toBeInTheDocument();
    expect(continueBtn).toBeEnabled();
    expect(lessBtn).toBeDisabled();

    fireEvent.click(moreBtn);
    expect(screen.getByText("$60 a year")).toBeInTheDocument();
    expect(lessBtn).toBeEnabled();

    fireEvent.click(lessBtn);
    expect(screen.getByText("$0 a year")).toBeInTheDocument();
    fireEvent.click(continueBtn);

    // On Q2, test moving slider first, then missing confidence hint
    expect(screen.getByText("Move the slider")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Less" }));
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "0");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(
      screen.getByText("Pick how sure you are to continue.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fairly sure" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // On GuessOtherScreen, untouched slider also blocks Continue until moved
    expect(screen.getByText("What do you think Melanie answered?")).toBeInTheDocument();
    expect(screen.getByText("Move the slider")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(
      screen.getByText("Move the slider to your guess to continue.")
    ).toBeInTheDocument();

    // Even moving slider directly to min (0) unlocks Continue
    fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } });
    expect(screen.getByText("$0 a year")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("scrolls smoothly to How many people are deciding when picking a family", () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollMock = vi.fn();
    Element.prototype.scrollIntoView = scrollMock;

    try {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: /Lewis family/i }));

      expect(scrollMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("completes the Weah 2-person flow with two-phase reveal, ordered ladder, and Advisor view", () => {
    render(<App />);

    expect(screen.getByText("Demo data — pending verification")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Weah family/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    // Person 1: Timothy
    expect(screen.getByText("Pass the phone to Timothy")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I'm Timothy, start" }));

    // Q1 card interest (confidently wrong: 600 vs 3240 on 0..6000)
    fireEvent.change(screen.getByRole("slider"), { target: { value: "600" } });
    expect(screen.getByText("$600 a year")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Very sure" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Q2 plan score
    fireEvent.change(screen.getByRole("slider"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Fairly sure" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Guess the other (Melanie)
    expect(screen.getByText("What do you think Melanie answered?")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Person 2: Melanie
    expect(screen.getByText("Pass the phone to Melanie")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I'm Melanie, start" }));

    fireEvent.change(screen.getByRole("slider"), { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Just guessing" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.change(screen.getByRole("slider"), { target: { value: "65" } });
    fireEvent.click(screen.getByRole("button", { name: "Fairly sure" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("What do you think Timothy answered?")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "2400" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Reveal Q1: Phase 1 hides plan answer and reveal sentence
    expect(screen.getByText("Here is what you guessed.")).toBeInTheDocument();
    expect(screen.getByText("Timothy: $600")).toBeInTheDocument();
    expect(screen.getByText("Melanie: $1,200")).toBeInTheDocument();
    expect(screen.queryByText(/Your plan:/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Your plan says you pay about/)
    ).not.toBeInTheDocument();

    // Tap "Show what your plan says" -> plan mark enters, then after 700ms sentence appears
    fireEvent.click(screen.getByRole("button", { name: "Show what your plan says" }));
    expect(screen.getByText("Your plan: $3,240")).toBeInTheDocument();
    expect(
      screen.queryByText(/Your plan says you pay about/)
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(750);
    });

    expect(
      screen.getByText(
        "Your plan says you pay about $3,240 a year in card interest, while $150,000 sits in cash."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Timothy was very sure and furthest away.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Timothy came closest to guessing what Melanie answered.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));

    // Reveal Q2 (two-phase again)
    revealPlanAndAdvance();
    expect(screen.getByText("Your plan scores 60.")).toBeInTheDocument();
    expect(screen.getByText("Melanie was closest.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "See what each step changes" })
    );

    // What each step changes: ordered cumulative ladder
    expect(
      screen.getByText("Your plan already calculated these steps in this order.")
    ).toBeInTheDocument();
    expect(screen.getByText("Plan score: 60")).toBeInTheDocument();
    expect(screen.getByText("Today: 60")).toBeInTheDocument();
    expect(screen.getByText("With these steps: 60")).toBeInTheDocument();

    const addNextBtn = screen.getByRole("button", { name: "Add next step" });
    const removeLastBtn = screen.getByRole("button", { name: "Remove last step" });
    expect(removeLastBtn).toBeDisabled();

    // Tapping Step 2 selects Step 1 AND Step 2 cumulatively (73, never skipping Step 1)
    fireEvent.click(screen.getByRole("button", { name: /Life insurance/i }));
    expect(screen.getByText("Plan score: 73")).toBeInTheDocument();
    expect(screen.getByText("With these steps: 73")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Pay off the credit card/i })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /Life insurance/i })
    ).toHaveAttribute("aria-pressed", "true");

    // Add next step -> Step 3 (78)
    fireEvent.click(addNextBtn);
    expect(screen.getByText("Plan score: 78")).toBeInTheDocument();
    expect(screen.getByText("With these steps: 78")).toBeInTheDocument();
    expect(addNextBtn).toBeDisabled();

    // Remove last step -> back to 73 -> 62 -> 60
    fireEvent.click(removeLastBtn);
    expect(screen.getByText("Plan score: 73")).toBeInTheDocument();
    fireEvent.click(removeLastBtn);
    expect(screen.getByText("Plan score: 62")).toBeInTheDocument();
    fireEvent.click(removeLastBtn);
    expect(screen.getByText("Plan score: 60")).toBeInTheDocument();

    // Tapping Step 1 directly selects Step 1 (62)
    fireEvent.click(
      screen.getByRole("button", { name: /Pay off the credit card/i })
    );
    expect(screen.getByText("Plan score: 62")).toBeInTheDocument();

    // Unscored recommendation listed under "Also in your plan"
    expect(screen.getByText("Also in your plan")).toBeInTheDocument();
    expect(screen.getByText("Add liability insurance")).toBeInTheDocument();
    expect(
      screen.getByText("Your plan has no score change for this one yet.")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Choose your first step" })
    );

    // Agreement
    expect(screen.getByText("When will you do it?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I agree — Timothy" }));
    expect(screen.queryByRole("heading", { name: "Agreed" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I agree — Melanie" }));

    expect(screen.getByRole("heading", { name: "Agreed" })).toBeInTheDocument();
    expect(screen.getByText(/Check-in on day 3:/)).toBeInTheDocument();
    expect(screen.getByText(/Check-in on day 30:/)).toBeInTheDocument();

    // Open Advisor view
    fireEvent.click(screen.getByRole("button", { name: "Advisor view" }));
    expect(screen.getByRole("heading", { name: "Advisor view" })).toBeInTheDocument();
    expect(screen.getByText("Confident and wrong")).toBeInTheDocument();
  });

  it("completes the Lewis 1-person flow end-to-end without the guess-the-other screen", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Lewis family/i }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByText("Pass the phone to Samantha")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I'm Samantha, start" }));

    fireEvent.change(screen.getByRole("slider"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Fairly sure" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.change(screen.getByRole("slider"), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Fairly sure" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Should go straight to Reveal Q1 without any Guess-the-other screen
    expect(screen.queryByText(/What do you think .* answered/i)).not.toBeInTheDocument();

    revealPlanAndAdvance();
    expect(
      screen.getByText(
        "Your plan scores 82, and still your savings run out at 73."
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));

    revealPlanAndAdvance();
    expect(screen.getByText("Your plan scores 82.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "See what each step changes" })
    );

    // Lewis has only unscored recommendations
    expect(screen.getByText("Also in your plan")).toBeInTheDocument();
    expect(
      screen.getByText("Review the 2030 home goal with your advisor")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your plan has no score change for this one yet.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add next step" })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Choose your first step" })
    );
    fireEvent.click(screen.getByRole("button", { name: "I agree — Samantha" }));
    expect(screen.getByRole("heading", { name: "Agreed" })).toBeInTheDocument();
  });

  it("reveals immediately without delay when prefers-reduced-motion is reduce", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Lewis family/i }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByRole("button", { name: "I'm Samantha, start" }));

    fireEvent.change(screen.getByRole("slider"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Fairly sure" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    fireEvent.change(screen.getByRole("slider"), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Fairly sure" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Here is what you guessed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show what your plan says" }));

    // Immediately visible without advancing timers
    expect(
      screen.getByText(
        "Your plan scores 82, and still your savings run out at 73."
      )
    ).toBeInTheDocument();
  });
});
