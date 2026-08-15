import { describe, expect, it } from "vitest";
import { isValidIndicWord } from "./indic-util";

describe("isValidIndicWord", () => {
  it("accepts words that open on a letter", () => {
    // the suggestions google returns for "every"
    expect(isValidIndicWord("एव्री")).toBe(true);
    expect(isValidIndicWord("एवेरी")).toBe(true);
    expect(isValidIndicWord("एवेर्य")).toBe(true);
    expect(isValidIndicWord("एवेरय")).toBe(true);
    expect(isValidIndicWord("नमस्ते")).toBe(true);
    expect(isValidIndicWord("पड़ेगा")).toBe(true);
  });

  it("rejects a word that opens on a dependent vowel sign", () => {
    // also returned for "every", and not typable
    expect(isValidIndicWord("ेवेरय")).toBe(false);
    expect(isValidIndicWord("ेवेरय")).toBe(false);
  });

  it("rejects a word that opens on a virama or a sign", () => {
    expect(isValidIndicWord("्वेरय")).toBe(false);
    expect(isValidIndicWord("ंवेरय")).toBe(false);
  });

  it("rejects two dependent vowel signs in a row", () => {
    expect(isValidIndicWord("कीे")).toBe(false);
  });

  it("rejects a dependent vowel sign straight after a virama", () => {
    expect(isValidIndicWord("क्ा")).toBe(false);
  });

  it("leaves words without indic characters alone", () => {
    expect(isValidIndicWord("every")).toBe(true);
    expect(isValidIndicWord("sarthak")).toBe(true);
    expect(isValidIndicWord("")).toBe(true);
  });

  it("checks the other indic blocks the same way", () => {
    // tamil, telugu and bengali share the layout
    expect(isValidIndicWord("வணக்கம்")).toBe(true);
    expect(isValidIndicWord("ెలుగు")).toBe(false);
    expect(isValidIndicWord("বাংলা")).toBe(true);
  });
});
