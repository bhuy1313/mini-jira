import { formatDuration } from "./duration";

export interface TimesheetCsvRow {
  date: string; // YYYY-MM-DD
  memberName: string;
  memberEmail: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  timeSpentMinutes: number;
  description: string | null;
  loggedAt: Date | string;
}

/**
 * Escapes a single field according to RFC 4180 rules, and applies
 * protection against CSV formula injection (OWASP CSV Injection).
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  // OWASP CSV Formula Injection defense:
  // If the cell begins with dangerous formula triggers (=, +, -, @, tab, cr), prepend single quote.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180: If field contains comma, quote, or newline, escape internal quotes and wrap in quotes.
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generates an RFC 4180 compliant CSV string with a UTF-8 Byte Order Mark (BOM).
 * The BOM (\uFEFF) ensures Microsoft Excel and spreadsheet programs automatically
 * parse Unicode and accented characters (e.g. Vietnamese) without mojibake.
 */
export function generateTimesheetCsv(rows: TimesheetCsvRow[]): string {
  const UTF8_BOM = "\uFEFF";

  const headers = [
    "Date",
    "Member Name",
    "Member Email",
    "Project",
    "Task ID",
    "Task Title",
    "Time Spent (Minutes)",
    "Time Spent (Hours)",
    "Time Spent (Formatted)",
    "Description",
    "Logged At",
  ];

  const headerLine = headers.map(escapeCsvField).join(",");

  const dataLines = rows.map((row) => {
    const decimalHours = (row.timeSpentMinutes / 60).toFixed(2);
    const formattedDuration = formatDuration(row.timeSpentMinutes);
    const loggedAtStr =
      row.loggedAt instanceof Date ? row.loggedAt.toISOString() : String(row.loggedAt);

    const fields = [
      escapeCsvField(row.date),
      escapeCsvField(row.memberName),
      escapeCsvField(row.memberEmail),
      escapeCsvField(row.projectName),
      escapeCsvField(row.taskId),
      escapeCsvField(row.taskTitle),
      escapeCsvField(row.timeSpentMinutes),
      escapeCsvField(decimalHours),
      escapeCsvField(formattedDuration),
      escapeCsvField(row.description ?? ""),
      escapeCsvField(loggedAtStr),
    ];

    return fields.join(",");
  });

  return `${UTF8_BOM}${headerLine}\r\n${dataLines.join("\r\n")}${dataLines.length > 0 ? "\r\n" : ""}`;
}
