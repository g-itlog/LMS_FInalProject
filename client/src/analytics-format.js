export const reportDate = (value, full = false) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    ...(full ? { year: "numeric" } : {}),
    timeZone: "Asia/Manila",
  }).format(new Date(`${value}T12:00:00+08:00`));
export const percent = (value) =>
  value == null
    ? "—"
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
