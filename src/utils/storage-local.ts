import type { AppData, Goals, DayData, Meal } from '../types';

const STORAGE_KEY = 'calorie-tracker-data';

const defaultGoals: Goals = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
};

export const getAppData = (): AppData => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { days: {}, goals: defaultGoals };
    }
  }
  return { days: {}, goals: defaultGoals };
};

export const saveAppData = (data: AppData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const getDayData = (date: string): DayData => {
  const appData = getAppData();
  return appData.days[date] || { date, meals: [] };
};

export const saveDayData = (dayData: DayData): void => {
  const appData = getAppData();
  appData.days[dayData.date] = dayData;
  saveAppData(appData);
};

export const addMeal = (date: string, meal: Meal): void => {
  const dayData = getDayData(date);
  dayData.meals.push(meal);
  saveDayData(dayData);
};

export const updateMeal = (date: string, mealId: string, updatedMeal: Meal): void => {
  const dayData = getDayData(date);
  const index = dayData.meals.findIndex(m => m.id === mealId);
  if (index !== -1) {
    dayData.meals[index] = updatedMeal;
    saveDayData(dayData);
  }
};

export const deleteMeal = (date: string, mealId: string): void => {
  const dayData = getDayData(date);
  dayData.meals = dayData.meals.filter(m => m.id !== mealId);
  saveDayData(dayData);
};

export const getGoals = (): Goals => {
  return getAppData().goals;
};

export const saveGoals = (goals: Goals): void => {
  const appData = getAppData();
  appData.goals = goals;
  saveAppData(appData);
};
