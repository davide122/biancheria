const ITALY_TIME_ZONE = "Europe/Rome";

export function getItalyDayInfo(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ITALY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Impossibile calcolare la data italiana");
  }

  const dayKey = `${year}-${month}-${day}`;

  return {
    dayKey,
    date: new Date(`${dayKey}T00:00:00.000Z`),
  };
}
