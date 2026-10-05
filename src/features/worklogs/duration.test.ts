import { describe, expect, it } from "vitest";
import { formatDuration, formatDurationDetailed, parseDuration } from "./duration";

describe("Duration Engine (Jira Standard)", () => {
  describe("parseDuration", () => {
    it("returns null for empty, null, undefined or whitespace input", () => {
      expect(parseDuration(null)).toBeNull();
      expect(parseDuration(undefined)).toBeNull();
      expect(parseDuration("")).toBeNull();
      expect(parseDuration("   ")).toBeNull();
    });

    it("parses single unit shorthand", () => {
      expect(parseDuration("30m")).toBe(30);
      expect(parseDuration("2h")).toBe(120);
      expect(parseDuration("1d")).toBe(480);
      expect(parseDuration("1w")).toBe(2400);
    });

    it("is case-insensitive", () => {
      expect(parseDuration("30M")).toBe(30);
      expect(parseDuration("2H")).toBe(120);
      expect(parseDuration("1D")).toBe(480);
      expect(parseDuration("1W")).toBe(2400);
    });

    it("parses combined units", () => {
      expect(parseDuration("1d 2h 30m")).toBe(480 + 120 + 30);
      expect(parseDuration("1w 2d 4h")).toBe(2400 + 960 + 240);
      expect(parseDuration("2h 15m")).toBe(135);
    });

    it("parses full words and plurals", () => {
      expect(parseDuration("1 week 2 days 4 hours 30 minutes")).toBe(2400 + 960 + 240 + 30);
      expect(parseDuration("2 hrs 15 mins")).toBe(135);
      expect(parseDuration("1 day")).toBe(480);
    });

    it("parses decimal hours and days", () => {
      expect(parseDuration("1.5h")).toBe(90);
      expect(parseDuration("0.5d")).toBe(240);
      expect(parseDuration("2.25h")).toBe(135);
    });

    it("supports plain integers as minutes", () => {
      expect(parseDuration("90")).toBe(90);
      expect(parseDuration("480")).toBe(480);
      expect(parseDuration("0")).toBeNull();
    });

    it("rejects invalid inputs", () => {
      expect(parseDuration("abc")).toBeNull();
      expect(parseDuration("2x")).toBeNull();
      expect(parseDuration("1h invalid")).toBeNull();
      expect(parseDuration("-5m")).toBeNull();
      expect(parseDuration("0m")).toBeNull();
    });
  });

  describe("formatDuration", () => {
    it("handles zero, negative, or invalid minutes", () => {
      expect(formatDuration(0)).toBe("0m");
      expect(formatDuration(-10)).toBe("0m");
      expect(formatDuration(null)).toBe("0m");
      expect(formatDuration(undefined)).toBe("0m");
      expect(formatDuration(NaN)).toBe("0m");
    });

    it("formats minutes only", () => {
      expect(formatDuration(45)).toBe("45m");
      expect(formatDuration(1)).toBe("1m");
    });

    it("formats hours and minutes", () => {
      expect(formatDuration(60)).toBe("1h");
      expect(formatDuration(90)).toBe("1h 30m");
      expect(formatDuration(135)).toBe("2h 15m");
    });

    it("formats days and hours", () => {
      expect(formatDuration(480)).toBe("1d");
      expect(formatDuration(540)).toBe("1d 1h");
      expect(formatDuration(615)).toBe("1d 2h 15m");
    });

    it("formats weeks, days, hours, minutes", () => {
      expect(formatDuration(2400)).toBe("1w");
      expect(formatDuration(2880)).toBe("1w 1d");
      expect(formatDuration(3630)).toBe("1w 2d 4h 30m");
    });
  });

  describe("formatDurationDetailed", () => {
    it("handles zero or null", () => {
      expect(formatDurationDetailed(0)).toBe("0 minutes");
      expect(formatDurationDetailed(null)).toBe("0 minutes");
    });

    it("formats singular and plural detailed units", () => {
      expect(formatDurationDetailed(60)).toBe("1 hour");
      expect(formatDurationDetailed(120)).toBe("2 hours");
      expect(formatDurationDetailed(480)).toBe("1 day");
      expect(formatDurationDetailed(960)).toBe("2 days");
      expect(formatDurationDetailed(2400)).toBe("1 week");
      expect(formatDurationDetailed(4800)).toBe("2 weeks");
      expect(formatDurationDetailed(540)).toBe("1 day 1 hour");
      expect(formatDurationDetailed(90)).toBe("1 hour 30 minutes");
    });
  });
});
