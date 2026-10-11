export const getSuggestionPosition = (
  anchor: { left: number; top: number; bottom: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number; left?: number; top?: number },
) => {
  const margin = 8;
  const viewportTop = viewport.top ?? 0;
  const viewportLeft = viewport.left ?? 0;
  const top = Math.max(
    viewportTop + margin,
    Math.min(anchor.top, viewportTop + viewport.height - margin),
  );
  const bottom = Math.max(
    viewportTop + margin,
    Math.min(anchor.bottom, viewportTop + viewport.height - margin),
  );
  const below = viewportTop + viewport.height - margin - bottom;
  const above = top - viewportTop - margin;
  const flip = size.height > below && above > below;
  const maxHeight = Math.max(0, flip ? above : below);
  return {
    left: Math.max(
      viewportLeft + margin,
      Math.min(
        anchor.left,
        viewportLeft + viewport.width - margin - size.width,
      ),
    ),
    top: flip
      ? Math.max(viewportTop + margin, top - Math.min(size.height, maxHeight))
      : bottom,
    maxHeight,
  };
};
