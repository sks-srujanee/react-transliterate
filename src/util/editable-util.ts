// Lets a plain-text contentEditable element look like an input to the
// component: `value`, `selectionStart`, `selectionEnd` and `setSelectionRange`
// are all expressed as offsets into its text content.

const bound = new WeakSet<HTMLElement>();

const locate = (root: Node, offset: number): [Node, number] => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last: Node | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.nodeValue?.length ?? 0;
    if (offset <= length) return [node, offset];
    offset -= length;
    last = node;
  }
  return last ? [last, last.nodeValue?.length ?? 0] : [root, 0];
};

const offsetOf = (root: Node, node: Node, offset: number) => {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
};

export function bindEditable(el: HTMLElement) {
  if (bound.has(el)) return;
  bound.add(el);
  // a native input keeps its selection after blur, so remember the last one
  let last = { start: 0, end: 0 };

  const read = () => {
    const sel = document.getSelection();
    if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      last = {
        start: offsetOf(el, range.startContainer, range.startOffset),
        end: offsetOf(el, range.endContainer, range.endOffset),
      };
    }
    return last;
  };

  Object.defineProperties(el, {
    value: {
      configurable: true,
      get: () => el.textContent ?? "",
      set: (next: string) => {
        el.textContent = next;
      },
    },
    selectionStart: { configurable: true, get: () => read().start },
    selectionEnd: { configurable: true, get: () => read().end },
    setSelectionRange: {
      configurable: true,
      value: (start: number, end: number) => {
        const range = document.createRange();
        range.setStart(...locate(el, start));
        range.setEnd(...locate(el, end));
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        last = { start, end };
      },
    },
  });
}

/** Same shape as `textarea-caret`: relative to the element's top left. */
export function getEditableCaretCoordinates(el: HTMLElement, position: number) {
  const length = el.textContent?.length ?? 0;
  const atEnd = position >= length;
  const range = document.createRange();
  range.setStart(...locate(el, atEnd ? Math.max(0, length - 1) : position));
  range.setEnd(...locate(el, atEnd ? length : position + 1));
  const rect = range.getBoundingClientRect();
  const origin = el.getBoundingClientRect();
  return {
    left: (atEnd && length ? rect.right : rect.left) - origin.left,
    top: rect.top - origin.top,
    height: rect.height || 20,
  };
}
