import { describe, expect, it } from "vitest";
import { applyApostropheCharacter } from "./apostrophe-util";
import { getApostropheCharacter } from "../constants/ApostropheCharacters";

const URDHA_COMA = "ʼ";

describe("getApostropheCharacter", () => {
  it("gives assamese the urdha coma", () => {
    expect(getApostropheCharacter("as")).toBe(URDHA_COMA);
  });

  it("leaves every other language on the plain apostrophe", () => {
    expect(getApostropheCharacter("hi")).toBe("'");
    expect(getApostropheCharacter("bn")).toBe("'");
    expect(getApostropheCharacter("ta")).toBe("'");
  });
});

describe("applyApostropheCharacter", () => {
  it("swaps the apostrophe inside a word in the script", () => {
    expect(applyApostropheCharacter("হ'ল", URDHA_COMA)).toBe(`হ${URDHA_COMA}ল`);
    expect(applyApostropheCharacter("ক'ত", URDHA_COMA)).toBe(`ক${URDHA_COMA}ত`);
  });

  it("swaps every apostrophe in the word", () => {
    expect(applyApostropheCharacter("ক'ত'ব", URDHA_COMA)).toBe(
      `ক${URDHA_COMA}ত${URDHA_COMA}ব`,
    );
  });

  it("leaves the typed english word alone", () => {
    expect(applyApostropheCharacter("h'l", URDHA_COMA)).toBe("h'l");
    expect(applyApostropheCharacter("don't", URDHA_COMA)).toBe("don't");
  });

  it("does nothing when the language keeps the plain apostrophe", () => {
    expect(applyApostropheCharacter("হ'ল", "'")).toBe("হ'ল");
  });

  it("leaves a word without an apostrophe untouched", () => {
    expect(applyApostropheCharacter("নমস্কাৰ", URDHA_COMA)).toBe("নমস্কাৰ");
  });
});
