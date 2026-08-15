import * as React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { rest } from "msw";
import { setupServer } from "msw/node";
import { ReactTransliterate, ReactTransliterateProps } from "./index";

const server = setupServer(
  rest.get("https://inputtools.google.com/request", (_, res, ctx) => {
    return res(ctx.json(["SUCCESS", [["there", ["hi", "hey", "hello"]]]]));
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
    const mockValue = "";
    const mockOnChangeText = jest.fn();
    render(
      <ReactTransliterate value={mockValue} onChangeText={mockOnChangeText} />,
    );
  });

  it("renders passed value in the input", () => {
    const mockData = "MOCK_VALUE";
    const mockValue = mockData;
    const mockOnChangeText = jest.fn();
    render(
      <ReactTransliterate value={mockValue} onChangeText={mockOnChangeText} />,
    );
    expect(screen.getByDisplayValue(mockData)).toBeInTheDocument();
  });

  it("calls onChangeText on user input", async () => {
    const mockData = "MOCK_VALUE";
    const mockValue = mockData;
    const mockOnChangeText = jest.fn();
    render(
      <ReactTransliterate value={mockValue} onChangeText={mockOnChangeText} />,
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
    const mockOnChangeText = jest.fn();
    render(<ControlledTransliterate onChangeText={mockOnChangeText} />);

    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "there" } });
    await waitFor(() => screen.getByText("hi"));

    fireEvent.keyDown(input, { key: " " });
    expect(mockOnChangeText).toHaveBeenLastCalledWith("hi ");
  });

  it("does not insert a trailing space when enter is pressed", async () => {
    const mockOnChangeText = jest.fn();
    render(<ControlledTransliterate onChangeText={mockOnChangeText} />);

    const input = screen.getByTestId("rt-input-component");
    fireEvent.change(input, { target: { value: "there" } });
    await waitFor(() => screen.getByText("hi"));

    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockOnChangeText).toHaveBeenLastCalledWith("hi");
  });

  it("inserts the purnaviram when full stop is pressed", async () => {
    server.use(
      rest.get("https://inputtools.google.com/request", (_, res, ctx) => {
        return res(ctx.json(["SUCCESS", [["namaste", ["नमस्ते"]]]]));
      }),
    );

    const mockOnChangeText = jest.fn();
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
    server.use(
      rest.get("https://inputtools.google.com/request", (_, res, ctx) => {
        return res(ctx.json(["SUCCESS", [["vanakkam", ["வணக்கம்"]]]]));
      }),
    );

    const mockOnChangeText = jest.fn();
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
    const mockOnChangeText = jest.fn();
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
    const mockOnChangeText = jest.fn();
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
    const mockOnChangeText = jest.fn();
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

  it("renders suggestions list", async () => {
    const mockData = "MOCK_VALUE";
    const mockValue = mockData;
    const mockOnChangeText = jest.fn();

    render(
      <ReactTransliterate value={mockValue} onChangeText={mockOnChangeText} />,
    );
    fireEvent.change(screen.getByTestId("rt-input-component"), {
      target: { value: "there" },
    });
    await waitFor(() => {
      expect(screen.getByText("hi")).toBeInTheDocument();
    });
  });
});
