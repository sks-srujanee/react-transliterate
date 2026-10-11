import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReactTransliterate, ReactTransliterateProps } from "./index";

vi.mock("./util/touch-util", () => ({ isTouchEnabled: () => true }));
vi.mock("textarea-caret", () => ({
  default: () => ({ left: 0, top: 0, height: 20 }),
}));
const originalViewport = Object.getOwnPropertyDescriptor(
  window,
  "visualViewport",
);
afterEach(() => {
  cleanup();
  if (originalViewport)
    Object.defineProperty(window, "visualViewport", originalViewport);
  else
    delete (window as unknown as { visualViewport?: unknown }).visualViewport;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const Editor = (props: Partial<ReactTransliterateProps>) => {
  const [value, setValue] = React.useState("");
  return (
    <ReactTransliterate {...props} value={value} onChangeText={setValue} />
  );
};
const start = async (props: Partial<ReactTransliterateProps> = {}) => {
  render(<Editor fetchSuggestions={async () => ["शब्द"]} {...props} />);
  const input = screen.getByTestId("rt-input-component") as HTMLInputElement;
  input.focus();
  fireEvent.input(input, {
    target: { value: "word" },
    inputType: "insertText",
    data: "d",
  });
  await screen.findByRole("option", { name: "शब्द" });
  return input;
};
const beforeInput = (
  input: HTMLElement,
  inputType: string,
  data: string | null,
  extra: InputEventInit = {},
) => {
  const event = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType,
    data,
    ...extra,
  });
  act(() => {
    input.dispatchEvent(event);
  });
  return event;
};

it.each([
  ["insertText", " ", "शब्द "],
  ["insertText", ".", "शब्द। "],
  ["insertText", "?", "शब्द? "],
  ["insertLineBreak", null, "शब्द "],
  ["insertParagraph", null, "शब्द "],
])(
  "accepts %s/%s through beforeinput when Android sends keyCode 229",
  async (inputType, data, value) => {
    const input = await start();
    expect(
      fireEvent.keyDown(input, { key: "Unidentified", keyCode: 229 }),
    ).toBe(true);
    expect(beforeInput(input, inputType!, data).defaultPrevented).toBe(true);
    expect(input).toHaveValue(value);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  },
);

it.each([
  ["insertText", " ", "word ", "शब्द "],
  ["insertText", ".", "word.", "शब्द। "],
  ["insertLineBreak", null, "word\n", "शब्द "],
])(
  "accepts non-cancelable %s/%s on input and restores the pre-trigger text on undo",
  async (inputType, data, typed, result) => {
    const input = await start({
      renderComponent: (props) => <textarea {...props} />,
    });
    expect(
      beforeInput(input, inputType!, data, { cancelable: false })
        .defaultPrevented,
    ).toBe(false);
    fireEvent.input(input, { target: { value: typed }, inputType, data });
    expect(input).toHaveValue(result);
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(input).toHaveValue("word");
    await waitFor(() => expect(input.selectionStart).toBe(4));
  },
);

it("does not interfere with composition, paste, autocorrection, or a moved caret", async () => {
  const input = await start();
  for (const [inputType, data, extra] of [
    ["insertCompositionText", " ", { isComposing: true }],
    ["insertText", " ", { isComposing: true }],
    ["insertFromPaste", " ", {}],
    ["insertReplacementText", " ", {}],
  ] as const) {
    expect(beforeInput(input, inputType, data, extra).defaultPrevented).toBe(
      false,
    );
  }
  input.setSelectionRange(1, 1);
  expect(beforeInput(input, "insertText", " ").defaultPrevented).toBe(false);
  expect(input).toHaveValue("word");
});

it("keeps composition text editable without accepting triggers and queries after commit", async () => {
  const fetchSuggestions = vi.fn(async () => ["शब्द"]);
  const input = await start({ fetchSuggestions });
  fetchSuggestions.mockClear();
  fireEvent.compositionStart(input);
  fireEvent.input(input, {
    target: { value: "wordx" },
    inputType: "insertCompositionText",
    data: "x",
    isComposing: true,
  });
  expect(beforeInput(input, "insertText", " ").defaultPrevented).toBe(false);
  expect(fetchSuggestions).not.toHaveBeenCalled();
  expect(input).toHaveValue("wordx");
  fireEvent.compositionEnd(input, { data: "wordx" });
  await screen.findByRole("option", { name: "शब्द" });
  expect(fetchSuggestions).toHaveBeenCalledTimes(1);
});

it("keeps local list space input ordinary and supports tapping after touch blur", async () => {
  render(
    <Editor
      suggestionTriggers={[{ trigger: "[", suggestions: ["[noise]"] }]}
    />,
  );
  const input = screen.getByRole("combobox");
  input.focus();
  fireEvent.input(input, {
    target: { value: "[no" },
    inputType: "insertText",
    data: "o",
  });
  expect(beforeInput(input, "insertText", " ").defaultPrevented).toBe(false);
  fireEvent.blur(input);
  fireEvent.click(screen.getByRole("option", { name: "[noise]" }));
  expect(input).toHaveValue("[noise] ");
});

it("allows custom acceptance text on software keyboard input", async () => {
  const input = await start({ triggerKeys: [{ key: " ", insertText: "!" }] });
  beforeInput(input, "insertText", " ");
  expect(input).toHaveValue("शब्द!");
});

it("repositions above the Android keyboard and cleans up viewport listeners", async () => {
  const viewport = Object.assign(new EventTarget(), {
    width: 300,
    height: 700,
    offsetLeft: 20,
    offsetTop: 0,
  });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: viewport,
  });
  const remove = vi.spyOn(viewport, "removeEventListener");
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        top: 350,
        left: 20,
        width: 250,
        height: this.tagName === "UL" ? 160 : 30,
        right: 270,
        bottom: 380,
      } as DOMRect;
    },
  );
  const input = await start();
  const list = screen.getByRole("listbox");
  const initialTop = parseFloat(list.style.top);
  viewport.height = 400;
  act(() => {
    viewport.dispatchEvent(new Event("resize"));
  });
  expect(parseFloat(list.style.top)).toBeLessThan(initialTop);
  expect(list.style.maxHeight).toBe("332px");
  fireEvent.change(input, { target: { value: "" } });
  cleanup();
  expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
});
