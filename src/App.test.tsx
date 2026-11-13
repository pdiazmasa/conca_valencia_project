import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

describe("Same Page end-to-end flows", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("completes the Weah 2-person flow end-to-end and saves to Advisor view", () => {
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
    const sliderQ1 = screen.getByRole("slider");
    fireEvent.change(sliderQ1, { target: { value: "600" } });
    expect(screen.getByText("$600 a year")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Very sure" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Q2 plan score
    const sliderQ2 = screen.getByRole("slider");
    fireEvent.change(sliderQ2, { target: { value: "80" } });
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

    // Reveal Q1
    expect(
      screen.getByText(
        "Your plan says you pay about $3,240 a year in card interest, while $150,000 sits in cash."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Timothy came closest to guessing what Melanie answered.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));

    // Reveal Q2
    expect(screen.getByText("Your plan scores 60.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "See what each step changes" })
    );

    // What each step changes
    expect(screen.getByText("Plan score: 60")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pay off the credit card/i }));
    expect(screen.getByText("Plan score: 62")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Life insurance/i }));
    expect(screen.getByText("Plan score: 73")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /liability insurance/i }));
    expect(screen.getByText("Plan score: 73")).toBeInTheDocument();
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

  it("completes the Lewis 1-person flow without the guess-the-other screen", () => {
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
    expect(
      screen.getByText(
        "Your plan scores 82, and still your savings run out at 73."
      )
    ).toBeInTheDocument();
  });
});
