import "./setup";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AskTayariButton } from "@/components/ai/AskTayariButton";

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="current-location">{location.pathname}{location.search}</output>;
}

function renderAssistant(placement: "header" | "floating", initialEntry = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AskTayariButton placement={placement} />
      <CurrentLocation />
    </MemoryRouter>
  );
}

test("renders an accessible desktop header control and discloses the candidate-control boundary", () => {
  renderAssistant("header");

  const trigger = screen.getByTestId("tayari-assistant-header");
  expect(trigger).toHaveAttribute("aria-label", "Open Tayari AI, your personalised career co-pilot");
  expect(trigger).toHaveTextContent("Tayari AI");

  fireEvent.click(trigger);

  expect(screen.getByText("Candidate-controlled by design")).toBeInTheDocument();
  expect(screen.getByText(/A portal submission is only shown as verified when a receipt is recorded/i)).toBeInTheDocument();
});

test("renders a mobile fixed launcher and routes a selected assistant action to a real product screen", () => {
  renderAssistant("floating");

  const trigger = screen.getByTestId("tayari-assistant-mobile");
  expect(trigger.className).toContain("fixed");
  expect(trigger).toHaveAttribute("aria-label", "Open Tayari AI, your personalised career co-pilot");

  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: /Find matching jobs/i }));

  expect(screen.getByTestId("current-location")).toHaveTextContent("/jobs?assistant=fresh-matches");
});

test("offers context-specific work on the resume page and links to visible agent evidence", () => {
  renderAssistant("header", "/resume");

  fireEvent.click(screen.getByTestId("tayari-assistant-header"));
  expect(screen.getByRole("button", { name: /Tailor to a job/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /View agent work and evidence/i }));
  expect(screen.getByTestId("current-location")).toHaveTextContent("/agents");
});
