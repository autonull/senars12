/** Shared SVG geometry for the series shape, so the full chart and the sparkline cannot drift. */

export const linePoints = (values: number[], height: number, width = 100): string => {
  const max = Math.max(...values, 1);
  const step = width / Math.max(values.length - 1, 1);
  return values
    .map((value, index) => `${(index * step).toFixed(2)},${(height - (value / max) * height).toFixed(2)}`)
    .join(' ');
};