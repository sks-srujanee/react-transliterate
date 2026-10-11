import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { ReactTransliterate, ReactTransliterateProps } from "./index";
import getCaretCoordinates from "textarea-caret";

vi.mock("textarea-caret", () => ({
  default: vi.fn((_input, position) => ({
    left: position * 8,
    top: 0,
    height: 20,
  })),
}));

/**
 * Stub the Google Input Tools call with a fixed list of suggestions
 */
const mockSuggestions = (suggestions: string[]) => {
  const fetchMock = vi.fn(async (url: string) => {
    const word = new URL(url).searchParams.get("text");

    return {
      ok: true,
      json: async () => ["SUCCESS", [[word, suggestions]]],
    } as Response;
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

let testClock = Date.now();
beforeEach(() => {
  // Expire shared Google results between tests; each case controls its own fetch.
  vi.spyOn(Date, "now").mockReturnValue((testClock += 300_001));
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * `ReactTransliterate` is a controlled component, so key handling can only
 * be tested with a wrapper that feeds the new value back as a prop
 */
const ControlledTransliterate = ({
  onChangeText,
  ...rest
}: Partial<ReactTransliterateProps> & {
  onChangeText: (text: string) => void;
}) => {
  const [value, setValue] = React.useState("");

  return (
    <ReactTransliterate
      {...rest}
      value={value}
      onChangeText={(text) => {
        setValue(text);
        onChangeText(text);
      }}
    />
  );
};

describe("ReactTransliterate", () => {
  it("anchors the box to the word instead of moving it on every keystroke", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 300,
      height: 40,
      top: 0,
      left: 0,
      right: 300,
      bottom: 40,
    } as DOMRect);
    const fetchSuggestions = vi
      .fn()
      .mockResolvedValueOnce(["पहला"])
      .mockImplementationOnce(() => new Promise(() => {}));
    render(
      <ControlledTransliterate
        fetchSuggestions={fetchSuggestions}
        onChangeText={vi.fn()}
      />,
    );
    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "one a" } });
    await screen.findByText("पहला");
    const box = screen.getByTestId("rt-suggestions-list");
    const left = box.style.left;
    fireEvent.change(input, { target: { value: "one ab" } });
    expect(getCaretCoordinates).toHaveBeenLastCalledWith(input, 4);
    expect(box.style.left).toBe(left);
    expect(box.style.opacity).toBe("");
    expect(box).toHaveAttribute("aria-busy", "true");
  });

  it("retains width while allowing shorter results to shrink in height", async () => {
    let size = { width: 240, height: 280 };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        return {
          top: 0,
          left: 0,
          right: 300,
          bottom: 40,
          ...(this.tagName === "UL" ? size : { width: 300, height: 40 }),
        } as DOMRect;
      },
    );
    const fetchSuggestions = vi
      .fn()
      .mockResolvedValueOnce(["पहला"])
      .mockResolvedValueOnce(["दूसरा"])
      .mockResolvedValueOnce(["तीसरा"]);
    render(
      <ControlledTransliterate
        fetchSuggestions={fetchSuggestions}
        onChangeText={vi.fn()}
      />,
    );
    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "a" } });
    await screen.findByText("पहला");
    const box = screen.getByTestId("rt-suggestions-list");
    expect(box.style.minWidth).toBe("240px");
    expect(box.style.minHeight).toBe("");
    size = { width: 120, height: 80 };
    fireEvent.change(input, { target: { value: "ab" } });
    await screen.findByText("दूसरा");
    expect(box.style.minWidth).toBe("240px");
    expect(box.style.minHeight).toBe("");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "c" } });
    await screen.findByText("तीसरा");
    expect(screen.getByTestId("rt-suggestions-list").style.minWidth).toBe(
      "120px",
    );
    expect(screen.getByTestId("rt-suggestions-list").style.minHeight).toBe("");
  });

  it.each(["mouse", "keyboard"])(
    "remembers the latest %s selection across component mounts",
    async (method) => {
      const fetchSuggestions = async () => ["पहला", "दूसरा", "तीसरा"];
      const first = render(
        <ControlledTransliterate
          fetchSuggestions={fetchSuggestions}
          onChangeText={vi.fn()}
        />,
      );
      const input = screen.getByTestId("rt-input-component");
      fireEvent.change(input, { target: { value: "word" } });
      await screen.findByText("दूसरा");
      if (method === "mouse") fireEvent.click(screen.getByText("दूसरा"));
      else {
        fireEvent.keyDown(input, { key: "ArrowDown" });
        fireEvent.keyDown(input, { key: "Enter" });
      }
      first.unmount();

      const second = render(
        <ControlledTransliterate
          fetchSuggestions={fetchSuggestions}
          onChangeText={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByTestId("rt-input-component"), {
        target: { value: "word" },
      });
      await screen.findByText("दूसरा");
      expect(screen.getAllByRole("option")[0]).toHaveTextContent("दूसरा");
      fireEvent.click(screen.getByText("तीसरा"));
      second.unmount();

      render(
        <ControlledTransliterate
          fetchSuggestions={fetchSuggestions}
          onChangeText={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByTestId("rt-input-component"), {
        target: { value: "word" },
      });
      await screen.findByText("तीसरा");
      expect(screen.getAllByRole("option")[0]).toHaveTextContent("तीसरा");
    },
  );

  it("does not restore a remembered choice rejected by validation", async () => {
    const fetchSuggestions = async () => ["पहला", "दूसरा"];
    const first = render(
      <ControlledTransliterate
        fetchSuggestions={fetchSuggestions}
        onChangeText={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "word" },
    });
    fireEvent.click(await screen.findByText("दूसरा"));
    first.unmount();
    render(
      <ControlledTransliterate
        fetchSuggestions={fetchSuggestions}
        validateSuggestions={async (list) =>
          list.filter((item) => item !== "दूसरा")
        }
        onChangeText={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "word" },
    });
    await screen.findByText("पहला");
    expect(screen.queryByText("दूसरा")).not.toBeInTheDocument();
  });

  it("requests six Google candidates plus the typed word by default", async () => {
    const fetchMock = mockSuggestions([
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
    ]);
    render(<ControlledTransliterate onChangeText={vi.fn()} />);
    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "word" },
    });
    await screen.findByText("six");
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("num")).toBe(
      "6",
    );
    expect(screen.getAllByRole("option")).toHaveLength(7);
  });

  it("updates the existing box in place and resets its selection when results arrive", async () => {
    let resolve!: (list: string[]) => void;
    const fetchSuggestions = vi
      .fn()
      .mockResolvedValueOnce(["पहला", "दूसरा"])
      .mockImplementationOnce(
        () =>
          new Promise<string[]>((done) => {
            resolve = done;
          }),
      );
    const onChangeText = vi.fn();
    render(
      <ControlledTransliterate
        fetchSuggestions={fetchSuggestions}
        onChangeText={onChangeText}
      />,
    );
    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "a" } });
    await screen.findByText("पहला");
    const box = screen.getByTestId("rt-suggestions-list");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.change(input, { target: { value: "ab" } });
    expect(screen.getByTestId("rt-suggestions-list")).toBe(box);
    await act(async () => {
      resolve(["नया"]);
    });
    expect(screen.getByTestId("rt-suggestions-list")).toBe(box);
    expect(box).toHaveAttribute("aria-busy", "false");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChangeText).toHaveBeenLastCalledWith("नया ");
  });

  it("does not commit suggestions for an earlier spelling while loading", async () => {
    const fetchSuggestions = vi
      .fn()
      .mockResolvedValueOnce(["पुराना"])
      .mockImplementationOnce(() => new Promise(() => {}));
    const onChangeText = vi.fn();
    render(
      <ControlledTransliterate
        fetchSuggestions={fetchSuggestions}
        onChangeText={onChangeText}
      />,
    );
    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "a" } });
    await screen.findByText("पुराना");
    fireEvent.change(input, { target: { value: "ab" } });
    expect(screen.getByTestId("rt-suggestions-list")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    fireEvent.click(screen.getByText("पुराना"));
    expect(onChangeText).toHaveBeenLastCalledWith("ab");
    fireEvent.keyDown(input, { key: " " });
    expect(onChangeText).toHaveBeenLastCalledWith("ab");
  });

  it.each(["delete", "escape", "blur"])(
    "ignores a late response after %s",
    async (action) => {
      let resolve!: (suggestions: string[]) => void;
      const fetchSuggestions = vi.fn(
        () =>
          new Promise<string[]>((done) => {
            resolve = done;
          }),
      );
      render(
        <ControlledTransliterate
          fetchSuggestions={fetchSuggestions}
          onChangeText={vi.fn()}
        />,
      );
      const input = screen.getByTestId("rt-input-component");
      fireEvent.change(input, { target: { value: "a" } });
      if (action === "delete")
        fireEvent.change(input, { target: { value: "" } });
      if (action === "escape") fireEvent.keyDown(input, { key: "Escape" });
      if (action === "blur") fireEvent.blur(input);
      expect(fetchSuggestions.mock.calls[0]).toBeDefined();
      await act(async () => {
        resolve(["पुराना"]);
      });
      expect(
        screen.queryByTestId("rt-suggestions-list"),
      ).not.toBeInTheDocument();
    },
  );

  it("inserts the displayed suggestion when the source contains duplicates", async () => {
    const onChangeText = vi.fn();
    render(
      <ControlledTransliterate
        fetchSuggestions={async () => ["पहला", "पहला", "दूसरा"]}
        onChangeText={onChangeText}
      />,
    );
    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "a" },
    });
    fireEvent.click(await screen.findByText("दूसरा"));
    expect(onChangeText).toHaveBeenLastCalledWith("दूसरा ");
  });

  it.each(["delete", "escape", "blur"])(
    "cancels a debounced request after %s",
    (action) => {
      vi.useFakeTimers();
      try {
        const fetchSuggestions = vi.fn(async () => ["पुराना"]);
        render(
          <ControlledTransliterate
            debounceMs={100}
            fetchSuggestions={fetchSuggestions}
            onChangeText={vi.fn()}
          />,
        );
        const input = screen.getByTestId("rt-input-component");
        fireEvent.change(input, { target: { value: "a" } });
        if (action === "delete")
          fireEvent.change(input, { target: { value: "" } });
        if (action === "escape") fireEvent.keyDown(input, { key: "Escape" });
        if (action === "blur") fireEvent.blur(input);
        act(() => vi.advanceTimersByTime(100));
        expect(fetchSuggestions).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("aborts the Google request when the spelling changes", () => {
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<ControlledTransliterate onChangeText={vi.fn()} />);
    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "a" } });
    const init = (
      fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    fireEvent.change(input, { target: { value: "ab" } });
    expect(init.signal?.aborted).toBe(true);
  });

  it("is truthy", () => {
    expect(ReactTransliterate).toBeTruthy();
  });

  it("renders without errors", () => {
    mockSuggestions(["hi", "hey", "hello"]);
    const mockOnChangeText = vi.fn();
    render(<ReactTransliterate value="" onChangeText={mockOnChangeText} />);
  });

  it("renders passed value in the input", () => {
    mockSuggestions(["hi", "hey", "hello"]);
    const mockData = "MOCK_VALUE";
    const mockOnChangeText = vi.fn();
    render(
      <ReactTransliterate value={mockData} onChangeText={mockOnChangeText} />,
    );
    expect(screen.getByDisplayValue(mockData)).toBeInTheDocument();
  });

  it("calls onChangeText on user input", async () => {
    mockSuggestions(["hi", "hey", "hello"]);
    const mockOnChangeText = vi.fn();
    render(
      <ReactTransliterate value="MOCK_VALUE" onChangeText={mockOnChangeText} />,
    );
    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "H" },
    });
    await waitFor(() => {
      expect(screen.getByTestId("rt-suggestions-list")).toBeInTheDocument();
      expect(mockOnChangeText).toBeCalled();
    });
  });

  it("inserts a trailing space when space is pressed", async () => {
    mockSuggestions(["hi", "hey", "hello"]);
    const mockOnChangeText = vi.fn();
    render(<ControlledTransliterate onChangeText={mockOnChangeText} />);

    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "there" } });
    await waitFor(() => screen.getByText("hi"));

    fireEvent.keyDown(input, { key: " " });
    expect(mockOnChangeText).toHaveBeenLastCalledWith("hi ");
  });

  it("inserts a trailing space when enter is pressed", async () => {
    mockSuggestions(["hi", "hey", "hello"]);
    const mockOnChangeText = vi.fn();
    render(<ControlledTransliterate onChangeText={mockOnChangeText} />);

    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "there" } });
    await waitFor(() => screen.getByText("hi"));

    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockOnChangeText).toHaveBeenLastCalledWith("hi ");
  });

  it("inserts the purnaviram when full stop is pressed", async () => {
    mockSuggestions(["नमस्ते"]);
    const mockOnChangeText = vi.fn();
    render(
      <ControlledTransliterate lang="hi" onChangeText={mockOnChangeText} />,
    );

    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "namaste" } });
    await waitFor(() => screen.getByText("नमस्ते"));

    fireEvent.keyDown(input, { key: "." });
    expect(mockOnChangeText).toHaveBeenLastCalledWith("नमस्ते। ");
  });

  it("inserts a full stop for languages without a purnaviram", async () => {
    mockSuggestions(["வணக்கம்"]);
    const mockOnChangeText = vi.fn();
    render(
      <ControlledTransliterate lang="ta" onChangeText={mockOnChangeText} />,
    );

    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "vanakkam" } });
    await waitFor(() => screen.getByText("வணக்கம்"));

    fireEvent.keyDown(input, { key: "." });
    expect(mockOnChangeText).toHaveBeenLastCalledWith("வணக்கம். ");
  });

  it("inserts a full stop when the english word is selected", async () => {
    mockSuggestions(["सार्थक"]);
    const mockOnChangeText = vi.fn();
    render(
      <ControlledTransliterate lang="hi" onChangeText={mockOnChangeText} />,
    );

    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "sarthak" } });
    await waitFor(() => screen.getByText("sarthak"));

    // move the selection to the english word, which is the last suggestion
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "." });
    expect(mockOnChangeText).toHaveBeenLastCalledWith("sarthak. ");
  });

  it("inserts punctuation followed by a space", async () => {
    mockSuggestions(["hi", "hey", "hello"]);
    const mockOnChangeText = vi.fn();
    render(<ControlledTransliterate onChangeText={mockOnChangeText} />);

    const input = screen.getByTestId("rt-input-component");

    for (const key of ["?", "!", ",", ";", ":"]) {
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.change(input, { target: { value: "there" } });
      await waitFor(() => screen.getByText("hi"));

      fireEvent.keyDown(input, { key });
      expect(mockOnChangeText).toHaveBeenLastCalledWith(`hi${key} `);
    }
  });

  it("keeps the typed word and hides suggestions on escape", async () => {
    mockSuggestions(["hi", "hey", "hello"]);
    const mockOnChangeText = vi.fn();
    render(<ControlledTransliterate onChangeText={mockOnChangeText} />);

    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "there" } });
    await waitFor(() => screen.getByText("hi"));

    fireEvent.keyDown(input, { key: "Escape" });

    // the typed word is untouched
    expect(mockOnChangeText).toHaveBeenLastCalledWith("there");
    expect(screen.queryByTestId("rt-suggestions-list")).not.toBeInTheDocument();

    // typing more of the same word does not bring the box back
    fireEvent.change(input, { target: { value: "theres" } });
    await waitFor(() =>
      expect(
        screen.queryByTestId("rt-suggestions-list"),
      ).not.toBeInTheDocument(),
    );

    // starting a new word shows suggestions again
    fireEvent.change(input, { target: { value: "theres there" } });
    await waitFor(() => screen.getByText("hi"));
  });

  // apps commonly close editors on escape from a window listener that blurs
  // whatever is focused. A capture phase listener runs before the keydown
  // reaches this component, so the suggestions are still open at blur time
  describe.each([
    ["bubble", false],
    ["capture", true],
  ])(
    "when a parent escape handler blurs the input in the %s phase",
    (_phase, useCapture) => {
      it("does not insert the suggestion", async () => {
        mockSuggestions(["hi", "hey", "hello"]);
        const mockOnChangeText = vi.fn();
        render(<ControlledTransliterate onChangeText={mockOnChangeText} />);

        const input = screen.getByTestId(
          "rt-input-component",
        ) as HTMLInputElement;

        const blurOnEscape = (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            (document.activeElement as HTMLElement)?.blur();
          }
        };
        window.addEventListener("keydown", blurOnEscape, useCapture);

        try {
          input.focus();
          fireEvent.change(input, { target: { value: "there" } });
          await waitFor(() => screen.getByText("hi"));

          fireEvent.keyDown(input, { key: "Escape" });

          // the insertion is deferred to the end of the dispatch, so give the
          // timer a chance to run before asserting that it did nothing
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(mockOnChangeText).toHaveBeenLastCalledWith("there");
          expect(
            screen.queryByTestId("rt-suggestions-list"),
          ).not.toBeInTheDocument();
        } finally {
          window.removeEventListener("keydown", blurOnEscape, useCapture);
        }
      });
    },
  );

  it("takes suggestions from a custom source", async () => {
    const fetchSuggestions = vi.fn(async () => ["बड़ा", "बड़े"]);
    const mockOnChangeText = vi.fn();

    render(
      <ControlledTransliterate
        lang="hi"
        fetchSuggestions={fetchSuggestions}
        onChangeText={mockOnChangeText}
      />,
    );

    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "बड" } });

    await waitFor(() => screen.getByText("बड़ा"));

    // the typed word is still appended as the last suggestion
    expect(screen.getByText("बड")).toBeInTheDocument();
    expect(fetchSuggestions).toHaveBeenCalledWith(
      "बड",
      expect.objectContaining({ lang: "hi", value: "बड", matchStart: 0 }),
    );
  });

  it("leaves out the typed word when the source refuses it", async () => {
    const fetchSuggestions = vi.fn(async () => ({
      suggestions: [],
      allowCurrentWord: false,
    }));

    render(
      <ControlledTransliterate
        lang="hi"
        fetchSuggestions={fetchSuggestions}
        onChangeText={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "ेवेरय" },
    });

    await waitFor(() => expect(fetchSuggestions).toHaveBeenCalled());
    expect(screen.queryByText("ेवेरय")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rt-suggestions-list")).not.toBeInTheDocument();
  });

  it("reports a failing source and closes the box", async () => {
    const onSuggestionsError = vi.fn();
    const fetchSuggestions = vi.fn(async () => {
      throw new Error("boom");
    });

    render(
      <ControlledTransliterate
        fetchSuggestions={fetchSuggestions}
        onSuggestionsError={onSuggestionsError}
        onChangeText={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "there" },
    });

    await waitFor(() =>
      expect(onSuggestionsError).toHaveBeenCalledWith(expect.any(Error)),
    );
    expect(screen.queryByTestId("rt-suggestions-list")).not.toBeInTheDocument();
  });

  it("does not query below minWordLength", async () => {
    const fetchSuggestions = vi.fn(async () => ["बड़ा"]);

    render(
      <ControlledTransliterate
        minWordLength={3}
        fetchSuggestions={fetchSuggestions}
        onChangeText={vi.fn()}
      />,
    );

    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "ba" } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchSuggestions).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "bad" } });
    await waitFor(() => expect(fetchSuggestions).toHaveBeenCalledTimes(1));
  });

  it("drops suggestions that the validator rejects", async () => {
    // a word that is well formed, so only an endpoint can judge it
    mockSuggestions(["एव्री", "एवेरय"]);
    const validateSuggestions = vi.fn(async (suggestions: string[]) =>
      suggestions.filter((suggestion) => suggestion !== "एवेरय"),
    );

    render(
      <ControlledTransliterate
        lang="hi"
        validateSuggestions={validateSuggestions}
        onChangeText={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "every" },
    });

    await waitFor(() => screen.getByText("एव्री"));
    expect(screen.queryByText("एवेरय")).not.toBeInTheDocument();

    // the validator sees the list after the local script check
    expect(validateSuggestions).toHaveBeenCalledWith(
      ["एव्री", "एवेरय", "every"],
      expect.objectContaining({ lang: "hi" }),
    );
  });

  it("writes the assamese urdha coma into the suggestions", async () => {
    // assamese writes the urdha coma as an apostrophe, so `h'l` is one word,
    // and google answers with the plain U+0027 that has to be swapped
    const fetchSuggestions = vi.fn(async () => [
      "\u09B9'\u09B2",
      "\u09B9'\u09B2\u09BE",
    ]);
    const mockOnChangeText = vi.fn();

    render(
      <ControlledTransliterate
        lang="as"
        fetchSuggestions={fetchSuggestions}
        onChangeText={mockOnChangeText}
      />,
    );

    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "h'l" } });

    await waitFor(() => screen.getByText("\u09B9\u02BC\u09B2"));

    // the apostrophe neither split the word nor committed the selection
    expect(fetchSuggestions).toHaveBeenCalledWith(
      "h'l",
      expect.objectContaining({ lang: "as", matchStart: 0 }),
    );

    // the typed word keeps the typewriter apostrophe
    expect(screen.getByText("h'l")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: " " });
    expect(mockOnChangeText).toHaveBeenLastCalledWith("\u09B9\u02BC\u09B2 ");
  });

  it("keeps the plain apostrophe for other languages", async () => {
    const fetchSuggestions = vi.fn(async () => ["\u09B9'\u09B2"]);
    const mockOnChangeText = vi.fn();

    render(
      <ControlledTransliterate
        lang="bn"
        fetchSuggestions={fetchSuggestions}
        onChangeText={mockOnChangeText}
      />,
    );

    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "h'l" },
    });

    await waitFor(() => screen.getByText("\u09B9'\u09B2"));
  });

  it("renders suggestions list", async () => {
    mockSuggestions(["hi", "hey", "hello"]);
    const mockOnChangeText = vi.fn();

    render(
      <ReactTransliterate value="MOCK_VALUE" onChangeText={mockOnChangeText} />,
    );
    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "there" },
    });
    await waitFor(() => {
      expect(screen.getByText("hi")).toBeInTheDocument();
    });
  });
});
