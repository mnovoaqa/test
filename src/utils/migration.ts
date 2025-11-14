import { supabase } from '../lib/supabase';
import { getAppData as getLocalAppData } from './storage-local';

const MIGRATION_KEY = 'calorie-tracker-migrated';

export const hasBeenMigrated = (): boolean => {
  return localStorage.getItem(MIGRATION_KEY) === 'true';
};

export const markAsMigrated = (): void => {
  localStorage.setItem(MIGRATION_KEY, 'true');
};

export const migrateLocalDataToSupabase = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Check if already migrated
    if (hasBeenMigrated()) {
      return { success: true };
    }

    // Get local data
    const localData = getLocalAppData();

    // Migrate goals
    if (localData.goals) {
      const { error: goalsError } = await supabase
        .from('goals')
        .upsert({
          user_id: user.id,
          calories: localData.goals.calories,
          protein: localData.goals.protein,
          carbs: localData.goals.carbs,
          fat: localData.goals.fat,
        });

      if (goalsError) {
        console.error('Error migrating goals:', goalsError);
      }
    }

    // Migrate meals
    const mealsToInsert = [];
    for (const [date, dayData] of Object.entries(localData.days)) {
      if (dayData.meals && dayData.meals.length > 0) {
        for (const meal of dayData.meals) {
          mealsToInsert.push({
            user_id: user.id,
            name: meal.name,
            calories: meal.calories,
            protein: meal.macros.protein,
            carbs: meal.macros.carbs,
            fat: meal.macros.fat,
            meal_date: date,
            timestamp: meal.timestamp,
          });
        }
      }
    }

    if (mealsToInsert.length > 0) {
      const { error: mealsError } = await supabase
        .from('meals')
        .insert(mealsToInsert);

      if (mealsError) {
        console.error('Error migrating meals:', mealsError);
        return { success: false, error: mealsError.message };
      }
    }

    // Mark as migrated
    markAsMigrated();

    return { success: true };
  } catch (error: any) {
    console.error('Migration error:', error);
    return { success: false, error: error.message };
  }
};
