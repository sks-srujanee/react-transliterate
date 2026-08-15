// `msMaxTouchPoints` is the legacy IE and old Edge equivalent of
// `maxTouchPoints` and is not part of the DOM types
type LegacyNavigator = Navigator & { msMaxTouchPoints?: number };

export function isTouchEnabled() {
  const legacyNavigator = navigator as LegacyNavigator;

  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (legacyNavigator.msMaxTouchPoints ?? 0) > 0
  );
}
