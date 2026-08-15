const STYLE_MARKER = "data-react-transliterate";

/**
 * Add the component styles to the document once.
 *
 * The styles are also emitted as `dist/index.css` for consumers who want to
 * load them through their own pipeline, but importing that file is easy to
 * miss and some bundlers refuse css imports from `node_modules`, so the
 * component ships its styles inside the javascript as well. Injecting the
 * same rules twice is harmless
 */
export const injectStyles = (css: string): void => {
  // no document while server rendering
  if (typeof document === "undefined") {
    return;
  }

  if (document.querySelector(`style[${STYLE_MARKER}]`)) {
    return;
  }

  const style = document.createElement("style");
  style.setAttribute(STYLE_MARKER, "");
  style.textContent = css;
  document.head.appendChild(style);
};
