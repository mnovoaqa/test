import type { AppData, Goals, DayData, Meal } from '../types';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

const defaultGoals: Goals = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
};

// Get all app data (for backward compatibility)
export const getAppData = async (): Promise<AppData> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { days: {}, goals: defaultGoals };

  const [mealsResult, goalsResult] = await Promise.all([
    supabase.from('meals').select('*').eq('user_id', user.id),
    supabase.from('goals').select('*').eq('user_id', user.id).single()
  ]);

  const days: Record<string, DayData> = {};

  if (mealsResult.data) {
    mealsResult.data.forEach((meal: any) => {
      const dateStr = meal.meal_date;
      if (!days[dateStr]) {
        days[dateStr] = { date: dateStr, meals: [] };
      }
      days[dateStr].meals.push({
        id: meal.id,
        name: meal.name,
        calories: meal.calories,
        macros: {
          protein: parseFloat(meal.protein),
          carbs: parseFloat(meal.carbs),
          fat: parseFloat(meal.fat),
        },
        timestamp: meal.timestamp,
      });
    });
  }

  return {
    days,
    goals: goalsResult.data ? {
      calories: goalsResult.data.calories,
      protein: goalsResult.data.protein,
      carbs: goalsResult.data.carbs,
      fat: goalsResult.data.fat,
    } : defaultGoals,
  };
};

export const getDayData = async (date: string): Promise<DayData> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { date, meals: [] };

  const { data: meals } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', user.id)
    .eq('meal_date', date)
    .order('timestamp', { ascending: true });

  return {
    date,
    meals: meals ? meals.map((meal: any) => ({
      id: meal.id,
      name: meal.name,
      calories: meal.calories,
      macros: {
        protein: parseFloat(meal.protein),
        carbs: parseFloat(meal.carbs),
        fat: parseFloat(meal.fat),
      },
      timestamp: meal.timestamp,
    })) : []
  };
};

export const addMeal = async (date: string, meal: Meal): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  await supabase.from('meals').insert({
    user_id: user.id,
    name: meal.name,
    calories: meal.calories,
    protein: meal.macros.protein,
    carbs: meal.macros.carbs,
    fat: meal.macros.fat,
    meal_date: date,
    timestamp: meal.timestamp,
  });
};

export const updateMeal = async (date: string, mealId: string, updatedMeal: Meal): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  await supabase
    .from('meals')
    .update({
      name: updatedMeal.name,
      calories: updatedMeal.calories,
      protein: updatedMeal.macros.protein,
      carbs: updatedMeal.macros.carbs,
      fat: updatedMeal.macros.fat,
    })
    .eq('id', mealId)
    .eq('user_id', user.id);
};

export const deleteMeal = async (date: string, mealId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  await supabase
    .from('meals')
    .delete()
    .eq('id', mealId)
    .eq('user_id', user.id);
};

export const getGoals = async (): Promise<Goals> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return defaultGoals;

  const { data } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!data) {
    // Create default goals for new user
    await supabase.from('goals').insert({
      user_id: user.id,
      ...defaultGoals,
    });
    return defaultGoals;
  }

  return {
    calories: data.calories,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
  };
};

export const saveGoals = async (goals: Goals): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: existing } = await supabase
    .from('goals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (existing) {
    await supabase
      .from('goals')
      .update(goals)
      .eq('user_id', user.id);
  } else {
    await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        ...goals,
      });
  }
};

// Keep saveDayData for backward compatibility (not used with Supabase)
export const saveDayData = async (dayData: DayData): Promise<void> => {
  // This function is not needed with Supabase as we handle individual meals
  console.warn('saveDayData is deprecated with Supabase');
};
