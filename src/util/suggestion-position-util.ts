export const getSuggestionPosition = (
  anchor: { left: number; top: number; bottom: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
) => {
  const margin = 8;
  const top = Math.max(margin, Math.min(anchor.top, viewport.height - margin));
  const bottom = Math.max(
    margin,
    Math.min(anchor.bottom, viewport.height - margin),
  );
  const below = viewport.height - margin - bottom;
  const above = top - margin;
  const flip = size.height > below && above > below;
  const maxHeight = Math.max(0, flip ? above : below);
  return {
    left: Math.max(
      margin,
      Math.min(anchor.left, viewport.width - margin - size.width),
    ),
    top: flip
      ? Math.max(margin, top - Math.min(size.height, maxHeight))
      : bottom,
    maxHeight,
  };
};
