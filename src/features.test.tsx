import * as React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  clearSuggestionHistory,
  ReactTransliterate,
  ReactTransliterateProps,
} from "./index";
import {
  getPreferredSuggestion,
  rememberSuggestion,
} from "./util/suggestion-history-util";

vi.mock("./util/touch-util", () => ({ isTouchEnabled: () => false }));
vi.mock("textarea-caret", () => ({
  default: () => ({ left: 0, top: 0, height: 20 }),
}));

let clock = Date.now();
beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue((clock += 300_001));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const Editor = (props: Partial<ReactTransliterateProps>) => {
  const [value, setValue] = React.useState("");
  return (
    <ReactTransliterate
      {...props}
      value={value}
      onChangeText={(next) => {
        setValue(next);
        props.onChangeText?.(next);
      }}
    />
  );
};
const type = (value: string) =>
  fireEvent.change(screen.getByTestId("rt-input-component"), {
    target: { value },
  });

const suggestionTriggers = [
  { trigger: "[", suggestions: ["[noise]", "[non_human_noise]", "[music]"] },
  { trigger: "#", suggestions: ["#ah", "#um", "#hm", "#uh"] },
] as const;

it.each(["mouse", "keyboard", "blur"])(
  "replaces the whole word edited in the middle by %s, preserving punctuation and undo",
  async (source) => {
    const fetchSuggestions = vi.fn().mockResolvedValue(["सार्थिहक"]);
    const onSuggestionSelect = vi.fn();
    render(
      <Editor
        fetchSuggestions={fetchSuggestions}
        onSuggestionSelect={onSuggestionSelect}
      />,
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    input.focus();
    fireEvent.change(input, {
      target: {
        value: "Hello, sartihak. next",
        selectionStart: 12,
        selectionEnd: 12,
      },
    });
    const option = await screen.findByRole("option", { name: "सार्थिहक" });
    expect(fetchSuggestions).toHaveBeenCalledWith(
      "sartihak",
      expect.objectContaining({
        matchStart: 7,
        matchEnd: 14,
      }),
    );
    if (source === "mouse") fireEvent.click(option);
    if (source === "keyboard") fireEvent.keyDown(input, { key: "Enter" });
    if (source === "blur") {
      input.blur();
      fireEvent.blur(input);
    }
    await waitFor(() => expect(input).toHaveValue("Hello, सार्थिहक. next"));
    expect(onSuggestionSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        word: "sartihak",
        insertText: "",
        source,
      }),
    );
    await waitFor(() =>
      expect(input.selectionStart).toBe(7 + "सार्थिहक".length),
    );
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(input).toHaveValue("Hello, sartihak. next");
    await waitFor(() => expect(input.selectionStart).toBe(12));
    expect(input.selectionEnd).toBe(12);
  },
);

it("edits a complete local token around the caret without duplicating its closing bracket", () => {
  render(<Editor suggestionTriggers={suggestionTriggers} />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, {
    target: {
      value: "hello [noise], next",
      selectionStart: 9,
      selectionEnd: 9,
    },
  });
  fireEvent.click(screen.getByRole("option", { name: "[noise]" }));
  expect(input).toHaveValue("hello [noise], next");
});

it("closes and cancels stale results when the cursor moves, forwarding onSelect", async () => {
  const onSelect = vi.fn();
  let resolve!: (options: string[]) => void;
  const fetchSuggestions = vi.fn<
    NonNullable<ReactTransliterateProps["fetchSuggestions"]>
  >(
    () =>
      new Promise<string[]>((done) => {
        resolve = done;
      }),
  );
  render(<Editor fetchSuggestions={fetchSuggestions} onSelect={onSelect} />);
  const input = screen.getByRole("combobox") as HTMLInputElement;
  input.focus();
  type("sarthak");
  input.setSelectionRange(4, 4);
  fireEvent.select(input);
  expect(onSelect).toHaveBeenCalled();
  expect(fetchSuggestions.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => {
    resolve(["stale"]);
  });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(input).toHaveValue("sarthak");
});

it("refuses a stale selection if the caret moves without a select event", async () => {
  render(<Editor fetchSuggestions={async () => ["choice"]} />);
  type("sarthak");
  const option = await screen.findByRole("option", { name: "choice" });
  const input = screen.getByRole("combobox") as HTMLInputElement;
  input.setSelectionRange(1, 3);
  fireEvent.click(option);
  expect(input).toHaveValue("sarthak");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

it("includes apostrophes and script characters across the caret, splitting on tabs", async () => {
  const fetchSuggestions = vi.fn().mockResolvedValue(["choice"]);
  render(<Editor fetchSuggestions={fetchSuggestions} />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, {
    target: { value: "hello\tcan't next", selectionStart: 8, selectionEnd: 8 },
  });
  await screen.findByRole("option", { name: "choice" });
  expect(fetchSuggestions).toHaveBeenLastCalledWith(
    "can't",
    expect.objectContaining({ matchStart: 6, matchEnd: 10 }),
  );
  fireEvent.change(input, {
    target: { value: "hello\tसार्थक next", selectionStart: 8, selectionEnd: 8 },
  });
  await waitFor(() =>
    expect(fetchSuggestions).toHaveBeenLastCalledWith(
      "सार्थक",
      expect.anything(),
    ),
  );
});

it("configures the highlight color while preserving active style overrides", async () => {
  const { rerender } = render(
    <Editor
      highlightColor="#123456"
      fetchSuggestions={async () => ["one", "two"]}
    />,
  );
  type("a");
  expect(await screen.findByRole("option", { name: "one" })).toHaveStyle({
    backgroundColor: "#123456",
  });
  expect(
    screen.getByRole("option", { name: "two" }).style.backgroundColor,
  ).toBe("");
  rerender(
    <Editor
      highlightColor="#123456"
      activeItemStyles={{ backgroundColor: "#abcdef", color: "black" }}
    />,
  );
  expect(screen.getByRole("option", { name: "one" })).toHaveStyle({
    backgroundColor: "#abcdef",
    color: "rgb(0, 0, 0)",
  });
});

it("shows local lists immediately and filters complete tokens without fetching or validating", () => {
  const fetchSuggestions = vi.fn();
  const validateSuggestions = vi.fn();
  render(
    <Editor
      suggestionTriggers={suggestionTriggers}
      fetchSuggestions={fetchSuggestions}
      validateSuggestions={validateSuggestions}
      debounceMs={500}
      minWordLength={5}
    />,
  );
  type("[");
  expect(screen.getAllByRole("option")).toHaveLength(3);
  expect(screen.getByRole("listbox")).toHaveAccessibleName("Suggestions for [");
  type("[NO");
  expect(screen.getAllByRole("option").map((item) => item.textContent)).toEqual(
    ["[noise]", "[non_human_noise]"],
  );
  type("#u");
  expect(screen.getAllByRole("option").map((item) => item.textContent)).toEqual(
    ["#um", "#uh"],
  );
  expect(fetchSuggestions).not.toHaveBeenCalled();
  expect(validateSuggestions).not.toHaveBeenCalled();
});

it.each(["Enter", "Tab", "click"])(
  "inserts a complete local token using %s and supports undo",
  async (key) => {
    const onSuggestionSelect = vi.fn();
    render(
      <Editor
        suggestionTriggers={suggestionTriggers}
        onSuggestionSelect={onSuggestionSelect}
      />,
    );
    type("hello [no");
    const input = screen.getByRole("combobox");
    if (key === "click")
      fireEvent.click(screen.getByRole("option", { name: "[noise]" }));
    else fireEvent.keyDown(input, { key });
    expect(input).toHaveValue("hello [noise] ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSuggestionSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        word: "[no",
        suggestion: "[noise]",
        value: "hello [noise] ",
      }),
    );
    expect(localStorage.getItem("react-transliterate:selections")).toBeNull();
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(input).toHaveValue("hello [no");
  },
);

it("keeps local lists as selection tools for punctuation, space, and blur", async () => {
  const onKeyDown = vi.fn();
  render(
    <Editor suggestionTriggers={suggestionTriggers} onKeyDown={onKeyDown} />,
  );
  type("#");
  const input = screen.getByRole("combobox");
  for (const key of [" ", ".", "?"]) {
    expect(fireEvent.keyDown(input, { key })).toBe(true);
    expect(input).toHaveValue("#");
  }
  expect(onKeyDown).toHaveBeenCalledTimes(3);
  fireEvent.blur(input);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(input).toHaveValue("#");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

it("dismisses unmatched local queries and Escape without falling back to transliteration", () => {
  const fetchSuggestions = vi.fn();
  render(
    <Editor
      suggestionTriggers={suggestionTriggers}
      fetchSuggestions={fetchSuggestions}
    />,
  );
  type("[zzz");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  type("[no");
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
  type("[noi");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(fetchSuggestions).not.toHaveBeenCalled();
});

it("cancels an in-flight transliteration when switching to a local list", async () => {
  let resolve!: (value: string[]) => void;
  const fetchSuggestions = vi.fn(
    () =>
      new Promise<string[]>((done) => {
        resolve = done;
      }),
  );
  render(
    <Editor
      suggestionTriggers={suggestionTriggers}
      fetchSuggestions={fetchSuggestions}
    />,
  );
  type("word");
  type("[no");
  expect(screen.getByRole("option", { name: "[noise]" })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
  await act(async () => {
    resolve(["stale"]);
  });
  expect(
    screen.queryByRole("option", { name: "stale" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("option", { name: "[noise]" })).toBeInTheDocument();
});

it("resumes transliteration after removing a prefix and limits local choices", async () => {
  const fetchSuggestions = vi.fn().mockResolvedValue(["translated"]);
  render(
    <Editor
      suggestionTriggers={suggestionTriggers}
      fetchSuggestions={fetchSuggestions}
      maxOptions={2}
    />,
  );
  type("[");
  expect(screen.getAllByRole("option")).toHaveLength(2);
  type("no");
  expect(
    await screen.findByRole("option", { name: "translated" }),
  ).toBeInTheDocument();
  expect(fetchSuggestions).toHaveBeenCalledWith("no", expect.anything());
});

it("replaces only the local query before the caret in multiline text", () => {
  render(
    <Editor
      suggestionTriggers={suggestionTriggers}
      renderComponent={(props) => <textarea {...props} />}
    />,
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "hello\n#u tail", selectionStart: 8, selectionEnd: 8 },
  });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowDown" });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(screen.getByRole("textbox")).toHaveValue("hello\n#uh tail");
});

it("keeps the default highlight on the first row when results reorder", async () => {
  const fetchSuggestions = vi
    .fn()
    .mockResolvedValueOnce(["one", "two"])
    .mockResolvedValueOnce(["two", "one"]);
  render(<Editor fetchSuggestions={fetchSuggestions} />);
  type("a");
  await screen.findByRole("option", { name: "one" });
  fireEvent.mouseEnter(screen.getByRole("option", { name: "two" }));
  expect(screen.getByRole("option", { name: "one" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  type("ab");
  await waitFor(() =>
    expect(screen.getByRole("option", { name: "two" })).toHaveAttribute(
      "aria-selected",
      "true",
    ),
  );
});

it.each(["keyboard", "mouse"])(
  "preserves an explicit %s choice when refreshed results reorder it",
  async (source) => {
    const onChangeText = vi.fn();
    const fetchSuggestions = vi
      .fn()
      .mockResolvedValueOnce(["one", "two"])
      .mockResolvedValueOnce(["two", "three"]);
    render(
      <Editor
        fetchSuggestions={fetchSuggestions}
        onChangeText={onChangeText}
      />,
    );
    type("a");
    await screen.findByRole("option", { name: "two" });
    const input = screen.getByRole("combobox");
    if (source === "keyboard") fireEvent.keyDown(input, { key: "ArrowDown" });
    else fireEvent.mouseMove(screen.getByRole("option", { name: "two" }));
    type("ab");
    await screen.findByRole("option", { name: "three" });
    expect(screen.getByRole("option", { name: "two" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChangeText).toHaveBeenLastCalledWith("two ");
  },
);

it("connects the editor, listbox, and active option without moving DOM focus", async () => {
  render(<Editor fetchSuggestions={async () => ["one", "two"]} />);
  const input = screen.getByRole("combobox");
  input.focus();
  expect(input).toHaveAttribute("aria-expanded", "false");
  type("a");
  const list = await screen.findByRole("listbox");
  expect(input).toHaveAttribute("aria-controls", list.id);
  expect(input).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(input).toHaveAttribute(
    "aria-activedescendant",
    screen.getByRole("option", { name: "two" }).id,
  );
  expect(document.activeElement).toBe(input);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveAttribute("aria-expanded", "false");
  expect(input).not.toHaveAttribute("aria-activedescendant");
});

it("keeps a textarea's multiline textbox semantics", async () => {
  render(
    <Editor
      renderComponent={(props) => <textarea {...props} />}
      fetchSuggestions={async () => ["one"]}
    />,
  );
  expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-expanded");
  type("a");
  const option = await screen.findByRole("option", { name: "one" });
  expect(screen.getByRole("textbox")).toHaveAttribute(
    "aria-activedescendant",
    option.id,
  );
});

it("uses unique listbox IDs for multiple editors", async () => {
  render(
    <>
      <Editor fetchSuggestions={async () => ["one"]} />
      <Editor fetchSuggestions={async () => ["two"]} />
    </>,
  );
  const inputs = screen.getAllByRole("combobox");
  fireEvent.change(inputs[0], { target: { value: "a" } });
  fireEvent.change(inputs[1], { target: { value: "b" } });
  await screen.findByRole("option", { name: "two" });
  expect(inputs[0].getAttribute("aria-controls")).not.toBe(
    inputs[1].getAttribute("aria-controls"),
  );
});

it.each(["mouse", "keyboard", "blur"])(
  "reports a selection accepted by %s",
  async (source) => {
    const onSuggestionSelect = vi.fn();
    render(
      <Editor
        fetchSuggestions={async () => ["choice"]}
        onSuggestionSelect={onSuggestionSelect}
      />,
    );
    type("word");
    const option = await screen.findByRole("option", { name: "choice" });
    const input = screen.getByRole("combobox");
    if (source === "mouse") fireEvent.click(option);
    if (source === "keyboard") fireEvent.keyDown(input, { key: "Enter" });
    if (source === "blur") fireEvent.blur(input);
    await waitFor(() =>
      expect(onSuggestionSelect).toHaveBeenCalledWith({
        word: "word",
        suggestion: "choice",
        lang: "hi",
        value: "choice ",
        insertText: " ",
        source,
      }),
    );
  },
);

it("ranks remembered choices without a marker and can clear their history", async () => {
  rememberSuggestion("word", "hi", "two");
  render(<Editor fetchSuggestions={async () => ["one", "two"]} />);
  type("word");
  await screen.findByRole("option", { name: "two" });
  expect(screen.queryByTitle("Last selected")).not.toBeInTheDocument();
  expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-label", "two");
  clearSuggestionHistory();
  expect(getPreferredSuggestion("word", "hi")).toBeUndefined();
});

it("disables both history reads and writes when remembering is turned off", async () => {
  rememberSuggestion("word", "hi", "two");
  const read = vi.spyOn(Storage.prototype, "getItem");
  const write = vi.spyOn(Storage.prototype, "setItem");
  render(
    <Editor
      rememberSelections={false}
      fetchSuggestions={async () => ["one", "two"]}
    />,
  );
  type("word");
  fireEvent.click(await screen.findByRole("option", { name: "two" }));
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(screen.queryByTitle("Last selected")).not.toBeInTheDocument();
});

it.each(["mouse", "keyboard"])(
  "undoes a %s acceptance and restores the selection",
  async (method) => {
    const onChangeText = vi.fn();
    render(
      <Editor
        fetchSuggestions={async () => ["choice"]}
        onChangeText={onChangeText}
      />,
    );
    type("word");
    const input = screen.getByRole("combobox") as HTMLInputElement;
    const option = await screen.findByRole("option", { name: "choice" });
    if (method === "mouse") fireEvent.click(option);
    else fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("choice ");
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(input.value).toBe("word");
    await waitFor(() => expect(input.selectionStart).toBe(4));
    expect(input.selectionEnd).toBe(4);
    expect(onChangeText).toHaveBeenLastCalledWith("word");
  },
);

it("leaves native undo and modifier shortcuts alone after further edits", async () => {
  const onKeyDown = vi.fn();
  render(
    <Editor fetchSuggestions={async () => ["choice"]} onKeyDown={onKeyDown} />,
  );
  type("word");
  fireEvent.click(await screen.findByRole("option", { name: "choice" }));
  type("choice x");
  await screen.findByRole("option", { name: "choice" });
  const input = screen.getByRole("combobox");
  expect(fireEvent.keyDown(input, { key: "z", metaKey: true })).toBe(true);
  expect(fireEvent.keyDown(input, { key: " ", ctrlKey: true })).toBe(true);
  expect(onKeyDown).toHaveBeenCalledTimes(2);
});

it("waits until composition finishes before querying and preserves composition callbacks", async () => {
  const fetchSuggestions = vi.fn(async () => ["choice"]);
  const onCompositionStart = vi.fn();
  const onCompositionEnd = vi.fn();
  render(
    <Editor
      fetchSuggestions={fetchSuggestions}
      onCompositionStart={onCompositionStart}
      onCompositionEnd={onCompositionEnd}
    />,
  );
  const input = screen.getByRole("combobox");
  input.focus();
  fireEvent.compositionStart(input);
  type("n");
  type("nam");
  expect(fireEvent.keyDown(input, { key: "Enter", isComposing: true })).toBe(
    true,
  );
  expect(fetchSuggestions).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  await screen.findByRole("option", { name: "choice" });
  expect(fetchSuggestions).toHaveBeenCalledOnce();
  expect(fetchSuggestions).toHaveBeenCalledWith("nam", expect.anything());
  expect(onCompositionStart).toHaveBeenCalledOnce();
  expect(onCompositionEnd).toHaveBeenCalledOnce();
});

it("does not query twice when compositionend is followed by a final change", async () => {
  vi.useFakeTimers();
  const fetchSuggestions = vi.fn(async () => ["choice"]);
  render(<Editor fetchSuggestions={fetchSuggestions} />);
  const input = screen.getByRole("combobox");
  input.focus();
  fireEvent.compositionStart(input);
  type("na");
  fireEvent.compositionEnd(input);
  type("nam");
  await act(async () => {
    vi.runOnlyPendingTimers();
  });
  expect(fetchSuggestions).toHaveBeenCalledOnce();
  expect(fetchSuggestions).toHaveBeenCalledWith("nam", expect.anything());
});

it("shows loading feedback only for a long wait and clears it on completion", async () => {
  vi.useFakeTimers();
  let resolve!: (list: string[]) => void;
  render(
    <Editor
      fetchSuggestions={() =>
        new Promise<string[]>((done) => {
          resolve = done;
        })
      }
    />,
  );
  type("word");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  act(() => vi.advanceTimersByTime(299));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("status")).toHaveTextContent("Updating suggestions");
  await act(async () => {
    resolve(["choice"]);
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "2 suggestions available",
  );
});

it("revalidates cached Google results and reports cache hits and stage durations", async () => {
  const fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ["SUCCESS", [["word", ["choice"]]]],
  }));
  vi.stubGlobal("fetch", fetch);
  const validateSuggestions = vi.fn(async (list: string[]) => list);
  const onSuggestionsTiming = vi.fn();
  render(
    <Editor
      validateSuggestions={validateSuggestions}
      onSuggestionsTiming={onSuggestionsTiming}
    />,
  );
  type("word");
  await screen.findByRole("option", { name: "choice" });
  type("");
  type("word");
  await screen.findByRole("option", { name: "choice" });
  expect(fetch).toHaveBeenCalledOnce();
  expect(validateSuggestions).toHaveBeenCalledTimes(2);
  expect(onSuggestionsTiming).toHaveBeenLastCalledWith(
    expect.objectContaining({
      word: "word",
      lang: "hi",
      cached: true,
      status: "success",
      fetchMs: expect.any(Number),
      validationMs: expect.any(Number),
      totalMs: expect.any(Number),
    }),
  );
});

it("reports source failures through both error and timing callbacks", async () => {
  const error = new Error("offline");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
  const onSuggestionsError = vi.fn();
  const onSuggestionsTiming = vi.fn();
  render(
    <Editor
      onSuggestionsError={onSuggestionsError}
      onSuggestionsTiming={onSuggestionsTiming}
    />,
  );
  type("word");
  await waitFor(() => expect(onSuggestionsError).toHaveBeenCalledWith(error));
  expect(onSuggestionsTiming).toHaveBeenCalledWith(
    expect.objectContaining({ status: "error" }),
  );
});

it("reports aborted requests without displaying their late results", async () => {
  let resolve!: (list: string[]) => void;
  const fetchSuggestions = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<string[]>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValueOnce(["new"]);
  const onSuggestionsTiming = vi.fn();
  render(
    <Editor
      fetchSuggestions={fetchSuggestions}
      onSuggestionsTiming={onSuggestionsTiming}
    />,
  );
  type("a");
  type("ab");
  await screen.findByRole("option", { name: "new" });
  await act(async () => {
    resolve(["old"]);
  });
  expect(onSuggestionsTiming).toHaveBeenLastCalledWith(
    expect.objectContaining({ word: "a", status: "aborted" }),
  );
  expect(screen.queryByRole("option", { name: "old" })).not.toBeInTheDocument();
});
