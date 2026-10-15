export const TAB_NAMES = ["Home", "Calendar", "Settings"];
export const CATEGORY_NAMES = ["Upcoming", "Completed", "Missed"];

export function pageIndex(offset, width, count = TAB_NAMES.length) {
  if (width <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(offset / width)));
}

// Only a deliberate outward vertical pull should light a scroll boundary.
export function boundaryPull({ dx, dy, offset, content, viewport }) {
  if (viewport <= 0 || Math.abs(dy) < 12 || Math.abs(dy) <= Math.abs(dx) * 1.3) return null;
  if (offset <= 1 && dy > 0) return "top";
  if (offset + viewport >= content - 1 && dy < 0) return "bottom";
  return null;
}

export function sheetDestination(distance, velocity, expanded) {
  "worklet";
  if (distance > 100 || velocity > 900) return expanded ? "collapse" : "close";
  if (!expanded && (distance < -65 || velocity < -650)) return "expand";
  return expanded ? "expanded" : "collapsed";
}
