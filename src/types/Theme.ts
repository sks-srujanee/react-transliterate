/**
 * Tokens for the suggestion box. Every token maps to a css custom property
 * on the list element, so a theme can also be set from a stylesheet by
 * declaring the same properties
 */
export interface ReactTransliterateTheme {
  /** background of the suggestion box */
  background?: string;
  /** text colour of a suggestion */
  color?: string;
  /** background of the highlighted suggestion */
  activeBackground?: string;
  /** text colour of the highlighted suggestion */
  activeColor?: string;
  /** border shorthand of the box */
  border?: string;
  /** corner radius of the box */
  borderRadius?: string;
  /** shadow cast by the box */
  boxShadow?: string;
  /** font family of the suggestions */
  fontFamily?: string;
  /** font size of the suggestions */
  fontSize?: string;
  /** vertical padding of a suggestion */
  itemPaddingBlock?: string;
  /** horizontal padding of a suggestion */
  itemPaddingInline?: string;
  /** smallest width the box can take */
  minWidth?: string;
  /** largest width the box can take before suggestions wrap */
  maxWidth?: string;
  /** height at which the box starts scrolling */
  maxHeight?: string;
  /** stacking order of the box */
  zIndex?: string | number;
}

export const THEME_CSS_PROPERTIES: Record<
  keyof ReactTransliterateTheme,
  string
> = {
  background: "--rt-background",
  color: "--rt-color",
  activeBackground: "--rt-active-background",
  activeColor: "--rt-active-color",
  border: "--rt-border",
  borderRadius: "--rt-border-radius",
  boxShadow: "--rt-box-shadow",
  fontFamily: "--rt-font-family",
  fontSize: "--rt-font-size",
  itemPaddingBlock: "--rt-item-padding-block",
  itemPaddingInline: "--rt-item-padding-inline",
  minWidth: "--rt-min-width",
  maxWidth: "--rt-max-width",
  maxHeight: "--rt-max-height",
  zIndex: "--rt-z-index",
};
