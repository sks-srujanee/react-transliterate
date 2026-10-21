import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ContentEditable, ReactTransliterate } from "./index";

vi.mock("./util/touch-util", () => ({ isTouchEnabled: () => false }));

const Editor = () => {
  const [value, setValue] = React.useState("");
  return (
    <ReactTransliterate
      value={value}
      onChangeText={setValue}
      fetchSuggestions={async () => ["नमस्ते"]}
      renderComponent={(props) => <ContentEditable {...props} />}
    />
  );
};

it("exposes text and selection offsets like an input", () => {
  render(<Editor />);
  const el = screen.getByRole("textbox") as HTMLInputElement;
  el.textContent = "hello world";
  el.setSelectionRange(2, 5);
  expect([el.value, el.selectionStart, el.selectionEnd]).toEqual([
    "hello world",
    2,
    5,
  ]);
});

it("accepts a suggestion into a contentEditable and keeps the text in sync", async () => {
  render(<Editor />);
  const el = screen.getByRole("textbox") as HTMLInputElement;
  el.textContent = "namaste";
  el.setSelectionRange(7, 7);
  fireEvent.input(el);
  fireEvent.click(await screen.findByRole("option", { name: "नमस्ते" }));
  expect(el.textContent).toBe("नमस्ते ");
});
