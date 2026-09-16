import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("../api/client", () => ({
  api: {
    taxonomy: async () => ({
      treatment_categories: ["mitigate"],
      action_statuses: ["proposed"],
      exposure_statuses: ["open"],
      relationship_semantics: {},
      glossary: [
        {
          id: "exposure",
          term: "Exposure",
          short: "This risk as it exists in this particular decision context.",
          distinction: "",
        },
      ],
      lenses: [],
    }),
    config: async () => ({ likelihood: { levels: [] } }),
    graphs: async () => [],
    seed: async () => ({}),
  },
}));

describe("App", () => {
  it("shows the product name and tagline", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findAllByText("Ellensúly")).not.toHaveLength(0);
    expect(screen.getByText("Risk, in context.")).toBeInTheDocument();
    expect(
      screen.getByText(/A response to a risk changes the landscape of other risks/i),
    ).toBeInTheDocument();
  });
});
