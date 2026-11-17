import { describe, expect, it } from "vitest";
import { addBusinessDays, formatDay } from "@/lib/day";
import { remindersSuspended } from "@/lib/payments/reported";

describe("dni robocze", () => {
  it("pomija weekend: piątek + 3 dni robocze = środa", () => {
    expect(formatDay(addBusinessDays(new Date("2026-11-13T10:00:00Z"), 3))).toBe("2026-11-18");
  });
  it("zwykły tydzień: poniedziałek + 3 dni = czwartek", () => {
    expect(formatDay(addBusinessDays(new Date("2026-11-16T10:00:00Z"), 3))).toBe("2026-11-19");
  });
});

describe("wstrzymanie przypomnień po „Już zapłaciłem”", () => {
  it("wstrzymuje przez 3 dni robocze, potem nie", () => {
    const reported = new Date("2026-11-16T10:00:00Z"); // poniedziałek
    expect(remindersSuspended(reported, new Date("2026-11-18T08:00:00Z"))).toBe(true);
    expect(remindersSuspended(reported, new Date("2026-11-20T08:00:00Z"))).toBe(false);
    expect(remindersSuspended(null, new Date("2026-11-18T08:00:00Z"))).toBe(false);
  });
});
