import { describe, expect, it } from "vitest";
import { escapeCsvField, generateTimesheetCsv, type TimesheetCsvRow } from "./csv-export";

describe("csv-export", () => {
  describe("escapeCsvField", () => {
    it("handles null and undefined", () => {
      expect(escapeCsvField(null)).toBe("");
      expect(escapeCsvField(undefined)).toBe("");
    });

    it("leaves normal strings unchanged", () => {
      expect(escapeCsvField("Hello World")).toBe("Hello World");
      expect(escapeCsvField(123)).toBe("123");
    });

    it("escapes fields containing commas", () => {
      expect(escapeCsvField("Nguyen, Van A")).toBe('"Nguyen, Van A"');
    });

    it("escapes fields containing double quotes", () => {
      expect(escapeCsvField('Feature "Search"')).toBe('"Feature ""Search"""');
    });

    it("escapes fields containing newlines", () => {
      expect(escapeCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });

    it("neutralizes potential CSV formula injection (=, +, -, @)", () => {
      expect(escapeCsvField("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(escapeCsvField("+123456")).toBe("'+123456");
      expect(escapeCsvField("-danger")).toBe("'-danger");
      expect(escapeCsvField("@execute")).toBe("'@execute");
    });
  });

  describe("generateTimesheetCsv", () => {
    it("starts with UTF-8 BOM byte sequence", () => {
      const csv = generateTimesheetCsv([]);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });

    it("includes standard headers and CRLF line breaks", () => {
      const csv = generateTimesheetCsv([]);
      expect(csv).toContain(
        "Date,Member Name,Member Email,Project,Task ID,Task Title,Time Spent (Minutes),Time Spent (Hours),Time Spent (Formatted),Description,Logged At\r\n",
      );
    });

    it("formats data rows accurately with decimal hours and formatted duration", () => {
      const rows: TimesheetCsvRow[] = [
        {
          date: "2026-10-02",
          memberName: "Nguyễn Văn A",
          memberEmail: "a@example.com",
          projectName: "Alpha Core",
          taskId: "task-1",
          taskTitle: "Fix OAuth, Login & UI",
          timeSpentMinutes: 150,
          description: "Completed bugfix for auth flow",
          loggedAt: new Date("2026-10-02T10:00:00.000Z"),
        },
        {
          date: "2026-10-02",
          memberName: "Trần Thị B",
          memberEmail: "b@example.com",
          projectName: "Beta UI",
          taskId: "task-2",
          taskTitle: "Design Sprint",
          timeSpentMinutes: 45,
          description: null,
          loggedAt: "2026-10-02T11:00:00.000Z",
        },
      ];

      const csv = generateTimesheetCsv(rows);
      expect(csv).toContain("Nguyễn Văn A");
      expect(csv).toContain('"Fix OAuth, Login & UI"');
      expect(csv).toContain("150,2.50,2h 30m");
      expect(csv).toContain("45,0.75,45m");
      expect(csv).toContain("2026-10-02T10:00:00.000Z");
    });
  });
});
