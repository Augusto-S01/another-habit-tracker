import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { normalizeEntries, lastNDaysISO, getNDaysStatistics, type Habit } from "./core";

describe("normalizeEntries", () => {
  it("returns [] when input is not an array", () => {
    expect(normalizeEntries(undefined)).toEqual([]);
    expect(normalizeEntries(null)).toEqual([]);
    expect(normalizeEntries("2025-12-13")).toEqual([]);
    expect(normalizeEntries({})).toEqual([]);
  });

  it("keeps only strings, removes duplicates, sorts", () => {
    const input = ["2025-12-13", "2025-12-11", "2025-12-13", 123, null, "2025-12-12"];
    expect(normalizeEntries(input)).toEqual(["2025-12-11", "2025-12-12", "2025-12-13"]);
  });
});

describe("lastNDaysISO", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // data local (meio-dia) para não dar problema de virada/UTC
    vi.setSystemTime(new Date(2025, 11, 13, 12, 0, 0)); // 2025-12-13
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns N dates including today, going backwards", () => {
    expect(lastNDaysISO(3)).toEqual(["2025-12-13", "2025-12-12", "2025-12-11"]);
  });

  it("returns empty array when n = 0", () => {
    expect(lastNDaysISO(0)).toEqual([]);
  });
});

describe("getNDaysStatistics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 11, 13, 12, 0, 0)); // 2025-12-13
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes avgHabitsDonePerDay as total marks across habits / Ndays", async () => {
    const habits: Habit[] = [
      { file: "a.md", habitName: "A", entries: ["2025-12-09", "2025-12-10", "2025-12-11"] }, // 3 marks
      { file: "b.md", habitName: "B", entries: ["2025-12-12", "2025-12-13"] },              // 2 marks
    ];

    const Ndays = 5; // 09..13
    const stats = await getNDaysStatistics(habits, Ndays);

    // totalMarks = 5, avg = 5/5 = 1
    expect(stats.avgHabitsDonePerDay).toBe(1);
  });

  it("identifies consistencyStreak in a single habit correctly", async () => {
    const habits: Habit[] = [
      { file: "a.md", habitName: "A", entries: ["2025-12-01","2025-12-02","2025-12-03","2025-12-04","2025-12-09", "2025-12-10", "2025-12-11"] }
    ];
    const Ndays = 13; // 01..13
    const stats = await getNDaysStatistics(habits, Ndays);

    expect(stats.consistencyStreak.length).toBe(3);
  });

  it("identifies consistencyStreak across multiple habits correctly", async () => {
    const habits: Habit[] = [
      { file: "a.md", habitName: "A", entries: ["2025-12-01","2025-12-08"] }, 
      { file: "b.md", habitName: "B", entries: ["2025-12-02","2025-12-05","2025-12-09"] }, 
      { file: "c.md", habitName: "C", entries: ["2025-12-03","2025-12-07","2025-12-10"] }, 
    ];
    const Ndays = 13;
    const stats = await getNDaysStatistics(habits, Ndays);
    expect(stats.consistencyStreak.length).toBe(4);
});

it("computes habit stats correctly", async () => {
    const habits: Habit[] = [
      { file: "a.md", habitName: "A", entries: ["2025-12-10", "2025-12-11", "2025-12-12"] }, // bestStreak=3, currentStreak=3
      { file: "b.md", habitName: "B", entries: ["2025-12-09", "2025-12-11", "2025-12-13"] }, // bestStreak=1, currentStreak=1
      { file: "c.md", habitName: "C", entries: ["2025-12-08", "2025-12-09", "2025-12-10", "2025-12-11"] }, // bestStreak=4, currentStreak=0
      { file: "d.md", habitName: "D", entries: [] }, // bestStreak=0, currentStreak=0
      { file: "e.md", habitName: "E", entries: ["2025-12-08","2025-12-09","2025-12-13"] }, // bestStreak=2, currentStreak=1
    ];
    const Ndays = 5; // 09..13
    const stats = await getNDaysStatistics(habits, Ndays);

    const habitAStats = stats.HabitStats.get("A");
    expect(habitAStats).toBeDefined();
    expect(habitAStats?.bestStreak).toBe(3);
    expect(habitAStats?.currentStreak).toBe(3);
    expect(habitAStats?.totalDone).toBe(3);
    
    const habitBStats = stats.HabitStats.get("B");
    expect(habitBStats).toBeDefined();
    expect(habitBStats?.bestStreak).toBe(1);
    expect(habitBStats?.currentStreak).toBe(1);
    expect(habitBStats?.totalDone).toBe(3);

    const habitCStats = stats.HabitStats.get("C");
    expect(habitCStats).toBeDefined();
    expect(habitCStats?.bestStreak).toBe(4);
    expect(habitCStats?.currentStreak).toBe(0);
    expect(habitCStats?.totalDone).toBe(2);

    const habitDStats = stats.HabitStats.get("D");
    expect(habitDStats).toBeDefined();
    expect(habitDStats?.bestStreak).toBe(0);
    expect(habitDStats?.currentStreak).toBe(0);
    expect(habitDStats?.totalDone).toBe(0);

    const habitEStats = stats.HabitStats.get("E");
    expect(habitEStats).toBeDefined();
    expect(habitEStats?.bestStreak).toBe(2);
    expect(habitEStats?.currentStreak).toBe(1);
    expect(habitEStats?.totalDone).toBe(3);

    });


    it("identifies bestHabitStreak correctly", async () => {
      const habits: Habit[] = [
        { file: "a.md", habitName: "A", entries: ["2025-12-10", "2025-12-11", "2025-12-12"] }, // bestStreak=3
        { file: "b.md", habitName: "B", entries: ["2025-12-09", "2025-12-11", "2025-12-13"] }, // bestStreak=1
        { file: "c.md", habitName: "C", entries: ["2025-12-08", "2025-12-09", "2025-12-10", "2025-12-11"] }, // bestStreak=4
        { file: "d.md", habitName: "D", entries: [] }, // bestStreak=0
      ];
      const Ndays = 5; // 09..13
      const stats = await getNDaysStatistics(habits, Ndays);
  
      expect(stats.bestHabitStreak.habitName).toBe("C");
      expect(stats.bestHabitStreak.length).toBe(4);
    });

    it("identifies habitWithLowestCompletionRate correctly", async () => {
        const habits: Habit[] = [
            { file: "a.md", habitName: "A", entries: ["2025-12-10", "2025-12-11", "2025-12-12"] }, // 3/5 = 60%
            { file: "b.md", habitName: "B", entries: ["2025-12-09"] }, // 1/5 = 20%
        ];
        const Ndays = 5; // 09..13
        const stats = await getNDaysStatistics(habits, Ndays);
    
        expect(stats.habitWithLowestCompletionRate.habitName).toBe("B");
        expect(stats.habitWithLowestCompletionRate.rate).toBeCloseTo(0.2);
      });


});


