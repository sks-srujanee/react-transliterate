import * as React from "react";
import { ReactTransliterateTheme, THEME_CSS_PROPERTIES } from "../types/Theme";

/**
 * Turn theme tokens into the css custom properties the stylesheet reads.
 * Tokens that are not set fall back to the defaults in the stylesheet
 */
export const toThemeStyles = (
  theme?: ReactTransliterateTheme,
): React.CSSProperties => {
  if (!theme) {
    return {};
  }

  const styles: Record<string, string> = {};

  (Object.keys(THEME_CSS_PROPERTIES) as Array<keyof ReactTransliterateTheme>)
    .filter((token) => theme[token] !== undefined)
    .forEach((token) => {
      styles[THEME_CSS_PROPERTIES[token]] = String(theme[token]);
    });

  return styles as React.CSSProperties;
};
