
export function normalizeEntries(entries: unknown): string[] {
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
  let lastNDays = lastNDaysISO(Ndays).reverse();
  let habitsDonePerDay = new Map<string, number>();



  for (const habit of habits) {

    const entries = habit.entries;
    let totalDone = 0;
    let bestStreak = 0;
    let currentStreak = 0;
    let lastNDaysStatus: {date: string; done: boolean}[] = [];
    let tempStreak = 0;

    for (const date of lastNDays) {
      if (entries.includes(date)) {
        totalDone++;
        tempStreak++;
        lastNDaysStatus.push({date, done: true});
        
        const habitsCount = habitsDonePerDay.get(date) ?? 0;
        habitsDonePerDay.set(date, habitsCount + 1);

      } else {
        if (tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
        tempStreak = 0;
        lastNDaysStatus.push({date, done: false});
      }
    }

    if (tempStreak > bestStreak) {
      bestStreak = tempStreak;
    }
    currentStreak = tempStreak;

    if (bestStreak > bestHabitStreak.length) {
      bestHabitStreak = {habitName: habit.habitName, length: bestStreak};
    }

    HabitStatsMap.set(habit.habitName, {
      habitName: habit.habitName,
      totalDone,
      bestStreak,
      currentStreak,
      lastNDays: lastNDaysStatus
    });
  }

  
  let totalMarks = 0;
  for (const v of habitsDonePerDay.values()) totalMarks += v;
  const avgHabitsDonePerDay = totalMarks / Ndays;


  const consistencyStreak = {length : 0 , lastDate : ""}
  const habitWithLowestCompletionRate = {habitName : "", rate: 0}
  
  return {
    HabitStats: HabitStatsMap,
    consistencyStreak ,
    avgHabitsDonePerDay,
    bestHabitStreak,
    habitWithLowestCompletionRate
  }
  
}

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