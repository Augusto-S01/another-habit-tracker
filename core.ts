
export interface Statictics {
  HabitStats: Map<string, HabitStats>;
  consistencyStreak : {length: number};
  avgHabitsDonePerDay : number;
  bestHabitStreak : {habitName: string; length: number};
  habitWithLowestCompletionRate : {habitName: string; rate: number};
}

export interface HabitStats {
    habitName: string;
    totalDone: number;
    bestStreak: number;
    currentStreak: number;
    lastNDays: {
      date: string;
      done: boolean;
    }[];
  }

export interface Habit{
  file: string;
  habitName: string;
  entries : string[];
}

export function normalizeEntries(entries: string[]): string[] {
  if (!Array.isArray(entries)) return [];
  const onlyStrings = entries.filter((x): x is string => typeof x === "string");
  return Array.from(new Set(onlyStrings)).sort();
}

export function lastNDaysISO(n: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}

export async function getNDaysStatistics(habits : Habit[] , Ndays: number): Promise<Statictics> {
  
  let bestHabitStreak = {habitName: "", length: 0};
  let HabitStatsMap = new Map<string, HabitStats>();
  const daysDesc = lastNDaysISO(Ndays);      
  const daysAsc  = [...daysDesc].reverse();  
  let habitsDonePerDay = new Map<string, number>();
  let habitWithLowestCompletionRate = { habitName: "", rate: Infinity };
  for (const habit of habits) {
    const entries = habit.entries;
    let totalDone = 0;
    

    const { best: bestStreak, current: currentStreak } = computeStreaks(entries, daysAsc[daysAsc.length -1]);
    
    if (bestStreak > bestHabitStreak.length) {
      bestHabitStreak = {habitName: habit.habitName, length: bestStreak};
    }

    for(const date of daysDesc) {
      if (entries.includes(date)) {
        totalDone++;
        const habitsCount = habitsDonePerDay.get(date) ?? 0;
        habitsDonePerDay.set(date, habitsCount + 1);
      }
    }
    const rate = totalDone / Ndays;

    if (rate < habitWithLowestCompletionRate.rate) {
        habitWithLowestCompletionRate = { habitName: habit.habitName, rate };
    }
    const set = new Set(entries)
    HabitStatsMap.set(habit.habitName, {
      habitName: habit.habitName,
      totalDone:entries.length,
      bestStreak,
      currentStreak,
      lastNDays: daysAsc.map(d => ({ date: d, done: set.has(d) }))
    });

    }


    /////////////////
    let totalMarks = 0;
    for (const v of habitsDonePerDay.values()) totalMarks += v;
    const avgHabitsDonePerDay = totalMarks / Ndays;
    

    const consistencyStreak = { length: computeConsistencyStreakAllTime(habits, daysDesc[0]) };


    return {
        HabitStats: HabitStatsMap,
        consistencyStreak ,
        avgHabitsDonePerDay,
        bestHabitStreak,
        habitWithLowestCompletionRate
    }
  
}

function computeConsistencyStreakAllTime(habits: Habit[], todayIso: string): number {
  const doneDays = new Set<number>();

  for (const h of habits) {
    for (const iso of h.entries) doneDays.add(toDayNumber(iso));
  }

  const today = toDayNumber(todayIso);
  const start =
    doneDays.has(today) ? today :
    doneDays.has(today - 1) ? today - 1 :
    null;

  if (start === null) return 0;

  let streak = 0;
  for (let d = start; doneDays.has(d); d--) streak++;

  return streak;
}



function computeStreaks(entries: string[], todayIso: string): { best: number; current: number } {
  if (entries.length === 0) return { best: 0, current: 0 };

  let best = 1;
  let run = 1;

  let prevDay = toDayNumber(entries[0]);

  for (let i = 1; i < entries.length; i++) {
    const curDay = toDayNumber(entries[i]);

    if (curDay === prevDay + 1) {
      run++;
    } else {
      run = 1;
    }

    if (run > best) best = run;
    prevDay = curDay;
  }

  const lastDay = prevDay; 
  const today = toDayNumber(todayIso);

  const current = (lastDay === today || lastDay === today - 1) ? run : 0;

  return { best, current };
}

function toDayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
