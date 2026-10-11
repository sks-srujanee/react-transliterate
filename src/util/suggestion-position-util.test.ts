import { expect, it } from "vitest";
import { getSuggestionPosition } from "./suggestion-position-util";

it("places a fitting popup below the word", () => {
  expect(
    getSuggestionPosition(
      { left: 20, top: 40, bottom: 70 },
      { width: 200, height: 120 },
      { width: 320, height: 480 },
    ),
  ).toEqual({ left: 20, top: 70, maxHeight: 402 });
});

it("flips above near the bottom and clamps the right edge", () => {
  expect(
    getSuggestionPosition(
      { left: 280, top: 370, bottom: 400 },
      { width: 200, height: 150 },
      { width: 320, height: 480 },
    ),
  ).toEqual({ left: 112, top: 220, maxHeight: 362 });
});

it("caps height when neither side fits and clamps the left edge", () => {
  expect(
    getSuggestionPosition(
      { left: -20, top: 90, bottom: 110 },
      { width: 200, height: 1000 },
      { width: 320, height: 200 },
    ),
  ).toEqual({ left: 8, top: 110, maxHeight: 82 });
});

it("keeps a scrolled-off anchor within the viewport", () => {
  const result = getSuggestionPosition(
    { left: 30, top: 900, bottom: 930 },
    { width: 200, height: 120 },
    { width: 320, height: 480 },
  );
  expect(result.top).toBe(352);
  expect(result.maxHeight).toBe(464);
});
