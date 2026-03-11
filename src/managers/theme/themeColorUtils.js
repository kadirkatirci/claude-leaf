export function lightenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const red = (num >> 16) + amt;
  const green = ((num >> 8) & 0x00ff) + amt;
  const blue = (num & 0x0000ff) + amt;

  return (
    '#' +
    (
      0x1000000 +
      (red < 255 ? (red < 1 ? 0 : red) : 255) * 0x10000 +
      (green < 255 ? (green < 1 ? 0 : green) : 255) * 0x100 +
      (blue < 255 ? (blue < 1 ? 0 : blue) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

export function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const red = (num >> 16) - amt;
  const green = ((num >> 8) & 0x00ff) - amt;
  const blue = (num & 0x0000ff) - amt;

  return (
    '#' +
    (
      0x1000000 +
      (red > 0 ? red : 0) * 0x10000 +
      (green > 0 ? green : 0) * 0x100 +
      (blue > 0 ? blue : 0)
    )
      .toString(16)
      .slice(1)
  );
}

export function createCustomTheme(color) {
  return {
    name: 'custom',
    primary: color,
    hover: lightenColor(color, 10),
    active: darkenColor(color, 10),
  };
}
