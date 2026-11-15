// Recordatorios para el calendario del usuario (archivo .ics generado en el navegador, sin backend).
// El propio calendario del móvil o del ordenador envía el aviso: Same Page no manda notificaciones.

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);

// Escapa el texto según el formato iCalendar (RFC 5545).
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Las líneas largas se parten a 75 caracteres; las siguientes empiezan con un espacio.
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    out.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  out.push(rest);
  return out.join("\r\n");
}

export type Reminder = { days: number; summary: string; description: string };

export function buildIcs(reminders: Reminder[], today: Date = new Date()): string {
  const stamp = utcStamp(today);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Same Page//Next steps//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  reminders.forEach((r, i) => {
    const day = addDays(today, r.days);
    lines.push(
      "BEGIN:VEVENT",
      `UID:same-page-${stamp}-${i}@same-page`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(day)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(day, 1))}`,
      `SUMMARY:${esc(r.summary)}`,
      `DESCRIPTION:${esc(r.description)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(r.summary)}`,
      "TRIGGER:PT9H",
      "END:VALARM",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(text: string, filename = "same-page-reminders.ics") {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
