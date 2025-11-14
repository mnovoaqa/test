import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Meal, Goals } from '../types';
import { getDayData, addMeal, deleteMeal, getGoals, getAppData } from '../utils/storage';
import './Today.css';

export default function Today() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [goals, setGoals] = useState<Goals>(getGoals());
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [trendData, setTrendData] = useState<any[]>([]);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const dayData = await getDayData(today);
    setMeals(dayData.meals);
    const userGoals = await getGoals();
    setGoals(userGoals);
    loadTrendData();
  };

  const loadTrendData = async () => {
    const appData = await getAppData();
    const data = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayData = appData.days[dateStr];

      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      if (dayData && dayData.meals) {
        dayData.meals.forEach(meal => {
          totalCalories += meal.calories;
          totalProtein += meal.macros.protein;
          totalCarbs += meal.macros.carbs;
          totalFat += meal.macros.fat;
        });
      }

      data.push({
        date: format(date, 'MMM dd'),
        calories: totalCalories,
        protein: totalProtein,
        carbs: totalCarbs,
        fat: totalFat,
      });
    }

    setTrendData(data);
  };

  const handleAddMeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const newMeal: Meal = {
      id: Date.now().toString(),
      name: formData.get('name') as string,
      calories: Number(formData.get('calories')),
      macros: {
        protein: Number(formData.get('protein')),
        carbs: Number(formData.get('carbs')),
        fat: Number(formData.get('fat')),
      },
      timestamp: new Date().toISOString(),
    };

    await addMeal(today, newMeal);
    loadData();
    setShowAddMeal(false);
  };

  const handleDeleteMeal = async (mealId: string) => {
    await deleteMeal(today, mealId);
    loadData();
  };

  const totals = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.macros.protein,
      carbs: acc.carbs + meal.macros.carbs,
      fat: acc.fat + meal.macros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const getPercentage = (current: number, goal: number) => {
    return Math.min((current / goal) * 100, 100);
  };

  return (
    <div className="today-page">
      <h1>Today's Nutrition</h1>
      <p className="date">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>

      <div className="summary-cards">
        <div className="summary-card">
          <h3>Calories</h3>
          <div className="value">
            <span className="current">{totals.calories}</span>
            <span className="goal">/ {goals.calories}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill calories"
              style={{ width: `${getPercentage(totals.calories, goals.calories)}%` }}
            />
          </div>
        </div>

        <div className="summary-card">
          <h3>Protein</h3>
          <div className="value">
            <span className="current">{totals.protein}g</span>
            <span className="goal">/ {goals.protein}g</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill protein"
              style={{ width: `${getPercentage(totals.protein, goals.protein)}%` }}
            />
          </div>
        </div>

        <div className="summary-card">
          <h3>Carbs</h3>
          <div className="value">
            <span className="current">{totals.carbs}g</span>
            <span className="goal">/ {goals.carbs}g</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill carbs"
              style={{ width: `${getPercentage(totals.carbs, goals.carbs)}%` }}
            />
          </div>
        </div>

        <div className="summary-card">
          <h3>Fat</h3>
          <div className="value">
            <span className="current">{totals.fat}g</span>
            <span className="goal">/ {goals.fat}g</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill fat"
              style={{ width: `${getPercentage(totals.fat, goals.fat)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="trend-section">
        <h2>7-Day Trend</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
              <YAxis stroke="rgba(255,255,255,0.6)" />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="calories" stroke="#ff6b6b" strokeWidth={2} />
              <Line type="monotone" dataKey="protein" stroke="#4ecdc4" strokeWidth={2} />
              <Line type="monotone" dataKey="carbs" stroke="#ffe66d" strokeWidth={2} />
              <Line type="monotone" dataKey="fat" stroke="#a8e6cf" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="meals-section">
        <div className="section-header">
          <h2>Meals</h2>
          <button className="add-btn" onClick={() => setShowAddMeal(true)}>+ Add Meal</button>
        </div>

        {meals.length === 0 ? (
          <div className="empty-state">
            <p>No meals logged yet. Click "Add Meal" to get started!</p>
          </div>
        ) : (
          <div className="meals-list">
            {meals.map(meal => (
              <div key={meal.id} className="meal-card">
                <div className="meal-info">
                  <h3>{meal.name}</h3>
                  <p className="meal-time">{format(new Date(meal.timestamp), 'h:mm a')}</p>
                </div>
                <div className="meal-macros">
                  <span className="macro-item calories">{meal.calories} cal</span>
                  <span className="macro-item protein">{meal.macros.protein}g P</span>
                  <span className="macro-item carbs">{meal.macros.carbs}g C</span>
                  <span className="macro-item fat">{meal.macros.fat}g F</span>
                </div>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteMeal(meal.id)}
                  aria-label="Delete meal"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddMeal && (
        <div className="modal-overlay" onClick={() => setShowAddMeal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Meal</h2>
            <form onSubmit={handleAddMeal}>
              <div className="form-group">
                <label>Meal Name</label>
                <input type="text" name="name" required placeholder="e.g., Breakfast, Lunch" />
              </div>
              <div className="form-group">
                <label>Calories</label>
                <input type="number" name="calories" required min="0" placeholder="500" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Protein (g)</label>
                  <input type="number" name="protein" required min="0" step="0.1" placeholder="30" />
                </div>
                <div className="form-group">
                  <label>Carbs (g)</label>
                  <input type="number" name="carbs" required min="0" step="0.1" placeholder="50" />
                </div>
                <div className="form-group">
                  <label>Fat (g)</label>
                  <input type="number" name="fat" required min="0" step="0.1" placeholder="20" />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowAddMeal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn">Add Meal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
