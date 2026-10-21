import * as React from "react";
import { bindEditable } from "./util/editable-util";

export interface ContentEditableProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  value: string;
  placeholder?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Plain-text contentEditable element for `renderComponent`:
 * `renderComponent={(props) => <ContentEditable {...props} />}`.
 * Needs `contenteditable="plaintext-only"` support (Chrome, Safari, Firefox 136+).
 */
export const ContentEditable = React.forwardRef<
  HTMLDivElement,
  ContentEditableProps
>(({ value, onChange, placeholder, style, ...rest }, forwardedRef) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const setRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      if (el) bindEditable(el);
      if (typeof forwardedRef === "function") forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    },
    [forwardedRef],
  );

  // the DOM is the source of truth while typing, only push real changes
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value) el.textContent = value;
  }, [value]);

  return (
    <div
      {...rest}
      ref={setRef}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-expanded={undefined}
      data-placeholder={placeholder}
      onInput={onChange as unknown as React.FormEventHandler<HTMLDivElement>}
      style={{ whiteSpace: "pre-wrap", ...style }}
    />
  );
});
ContentEditable.displayName = "ContentEditable";
