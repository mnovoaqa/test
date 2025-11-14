import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import type { Meal, DayData } from '../types';
import { getAppData, getDayData, addMeal, updateMeal, deleteMeal } from '../utils/storage';
import './History.css';

export default function History() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [monthData, setMonthData] = useState<Record<string, DayData>>({});

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  useEffect(() => {
    loadMonthData();
  }, [currentMonth]);

  useEffect(() => {
    if (selectedDate) {
      loadMeals(selectedDate);
    }
  }, [selectedDate]);

  const loadMonthData = async () => {
    const appData = await getAppData();
    setMonthData(appData.days);
  };

  const loadMeals = async (date: string) => {
    const dayData = await getDayData(date);
    setMeals(dayData.meals);
  };

  const getDayTotals = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayData = monthData[dateStr];

    if (!dayData || !dayData.meals || dayData.meals.length === 0) {
      return null;
    }

    return dayData.meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.macros.protein,
        carbs: acc.carbs + meal.macros.carbs,
        fat: acc.fat + meal.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
    setEditingMeal(null);
    setShowAddMeal(false);
  };

  const handleAddMeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDate) return;

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
      timestamp: new Date(selectedDate).toISOString(),
    };

    await addMeal(selectedDate, newMeal);
    await loadMeals(selectedDate);
    await loadMonthData();
    setShowAddMeal(false);
  };

  const handleUpdateMeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDate || !editingMeal) return;

    const formData = new FormData(e.currentTarget);
    const updatedMeal: Meal = {
      ...editingMeal,
      name: formData.get('name') as string,
      calories: Number(formData.get('calories')),
      macros: {
        protein: Number(formData.get('protein')),
        carbs: Number(formData.get('carbs')),
        fat: Number(formData.get('fat')),
      },
    };

    await updateMeal(selectedDate, editingMeal.id, updatedMeal);
    await loadMeals(selectedDate);
    await loadMonthData();
    setEditingMeal(null);
  };

  const handleDeleteMeal = async (mealId: string) => {
    if (!selectedDate) return;
    await deleteMeal(selectedDate, mealId);
    await loadMeals(selectedDate);
    await loadMonthData();
  };

  const startEditingMeal = (meal: Meal) => {
    setEditingMeal(meal);
    setShowAddMeal(false);
  };

  return (
    <div className="history-page">
      <h1>History</h1>

      <div className="calendar-container">
        <div className="calendar-header">
          <button className="nav-btn" onClick={handlePrevMonth}>←</button>
          <h2>{format(currentMonth, 'MMMM yyyy')}</h2>
          <button className="nav-btn" onClick={handleNextMonth}>→</button>
        </div>

        <div className="calendar-grid">
          <div className="calendar-weekday">Sun</div>
          <div className="calendar-weekday">Mon</div>
          <div className="calendar-weekday">Tue</div>
          <div className="calendar-weekday">Wed</div>
          <div className="calendar-weekday">Thu</div>
          <div className="calendar-weekday">Fri</div>
          <div className="calendar-weekday">Sat</div>

          {Array.from({ length: calendarDays[0].getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="calendar-day empty" />
          ))}

          {calendarDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const totals = getDayTotals(day);
            const isSelected = selectedDate === dateStr;
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={dateStr}
                className={`calendar-day ${!isSameMonth(day, currentMonth) ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => handleDateClick(day)}
              >
                <div className="day-number">{format(day, 'd')}</div>
                {totals && (
                  <div className="day-totals">
                    <div className="total-item calories">{totals.calories}</div>
                    <div className="totals-macros">
                      <span className="total-macro protein">{totals.protein}g</span>
                      <span className="total-macro carbs">{totals.carbs}g</span>
                      <span className="total-macro fat">{totals.fat}g</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="day-details">
          <div className="details-header">
            <h2>{format(new Date(selectedDate), 'EEEE, MMMM d, yyyy')}</h2>
            <button className="add-btn" onClick={() => { setShowAddMeal(true); setEditingMeal(null); }}>
              + Add Meal
            </button>
          </div>

          {meals.length === 0 ? (
            <div className="empty-state">
              <p>No meals logged for this date.</p>
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
                  <div className="meal-actions">
                    <button className="edit-btn" onClick={() => startEditingMeal(meal)}>✎</button>
                    <button className="delete-btn" onClick={() => handleDeleteMeal(meal.id)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(showAddMeal || editingMeal) && (
        <div className="modal-overlay" onClick={() => { setShowAddMeal(false); setEditingMeal(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingMeal ? 'Edit Meal' : 'Add Meal'}</h2>
            <form onSubmit={editingMeal ? handleUpdateMeal : handleAddMeal}>
              <div className="form-group">
                <label>Meal Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingMeal?.name}
                  placeholder="e.g., Breakfast, Lunch"
                />
              </div>
              <div className="form-group">
                <label>Calories</label>
                <input
                  type="number"
                  name="calories"
                  required
                  min="0"
                  defaultValue={editingMeal?.calories}
                  placeholder="500"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Protein (g)</label>
                  <input
                    type="number"
                    name="protein"
                    required
                    min="0"
                    step="0.1"
                    defaultValue={editingMeal?.macros.protein}
                    placeholder="30"
                  />
                </div>
                <div className="form-group">
                  <label>Carbs (g)</label>
                  <input
                    type="number"
                    name="carbs"
                    required
                    min="0"
                    step="0.1"
                    defaultValue={editingMeal?.macros.carbs}
                    placeholder="50"
                  />
                </div>
                <div className="form-group">
                  <label>Fat (g)</label>
                  <input
                    type="number"
                    name="fat"
                    required
                    min="0"
                    step="0.1"
                    defaultValue={editingMeal?.macros.fat}
                    placeholder="20"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => { setShowAddMeal(false); setEditingMeal(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  {editingMeal ? 'Update Meal' : 'Add Meal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
