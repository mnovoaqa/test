export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

export interface Meal {
  id: string;
  name: string;
  calories: number;
  macros: Macros;
  timestamp: string;
}

export interface DayData {
  date: string;
  meals: Meal[];
}

export interface Goals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface AppData {
  days: Record<string, DayData>;
  goals: Goals;
}
