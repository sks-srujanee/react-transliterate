import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReactTransliterate, ReactTransliterateProps } from "./index";

/**
 * Stub the Google Input Tools call with a fixed list of suggestions
 */
const mockSuggestions = (suggestions: string[]) => {
  const fetchMock = vi.fn(async (url: string) => {
    const word = new URL(url).searchParams.get("text");

    return {
      json: async () => ["SUCCESS", [[word, suggestions]]],
    } as Response;
  });

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

afterEach(() => {
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

  it("drops suggestions that are not typable in the script", async () => {
    // what google answers for "every": one option opens on a matra
    mockSuggestions(["एव्री", "एवेरी", "ेवेरय", "एवेरय"]);

    render(<ControlledTransliterate lang="hi" onChangeText={vi.fn()} />);

    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "every" },
    });

    await waitFor(() => screen.getByText("एव्री"));
    expect(screen.queryByText("ेवेरय")).not.toBeInTheDocument();
    expect(screen.getByText("एवेरय")).toBeInTheDocument();
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

  it("keeps invalid suggestions when the filter is off", async () => {
    mockSuggestions(["एव्री", "ेवेरय"]);

    render(
      <ControlledTransliterate
        lang="hi"
        filterInvalidSuggestions={false}
        onChangeText={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "every" },
    });

    await waitFor(() => screen.getByText("ेवेरय"));
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
