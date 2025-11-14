import { useState, useEffect } from 'react';
import type { Goals } from '../types';
import { getGoals, saveGoals } from '../utils/storage';
import './Settings.css';

export default function Settings() {
  const [goals, setGoals] = useState<Goals>({
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 65,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    const userGoals = await getGoals();
    setGoals(userGoals);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const newGoals: Goals = {
      calories: Number(formData.get('calories')),
      protein: Number(formData.get('protein')),
      carbs: Number(formData.get('carbs')),
      fat: Number(formData.get('fat')),
    };

    await saveGoals(newGoals);
    setGoals(newGoals);
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  const handleReset = () => {
    const defaultGoals: Goals = {
      calories: 2000,
      protein: 150,
      carbs: 250,
      fat: 65,
    };
    setGoals(defaultGoals);
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <p className="subtitle">Adjust your daily nutrition goals</p>

      <div className="settings-container">
        <form onSubmit={handleSubmit}>
          <div className="settings-section">
            <h2>Daily Goals</h2>

            <div className="goal-card">
              <div className="goal-header">
                <div className="goal-icon calories-icon">🔥</div>
                <div className="goal-info">
                  <label htmlFor="calories">Calories</label>
                  <p className="goal-description">Total daily caloric intake target</p>
                </div>
              </div>
              <div className="goal-input-wrapper">
                <input
                  type="number"
                  id="calories"
                  name="calories"
                  min="0"
                  step="50"
                  defaultValue={goals.calories}
                  required
                />
                <span className="unit">kcal</span>
              </div>
            </div>

            <div className="goal-card">
              <div className="goal-header">
                <div className="goal-icon protein-icon">💪</div>
                <div className="goal-info">
                  <label htmlFor="protein">Protein</label>
                  <p className="goal-description">Essential for muscle growth and repair</p>
                </div>
              </div>
              <div className="goal-input-wrapper">
                <input
                  type="number"
                  id="protein"
                  name="protein"
                  min="0"
                  step="5"
                  defaultValue={goals.protein}
                  required
                />
                <span className="unit">g</span>
              </div>
            </div>

            <div className="goal-card">
              <div className="goal-header">
                <div className="goal-icon carbs-icon">🌾</div>
                <div className="goal-info">
                  <label htmlFor="carbs">Carbohydrates</label>
                  <p className="goal-description">Primary energy source for your body</p>
                </div>
              </div>
              <div className="goal-input-wrapper">
                <input
                  type="number"
                  id="carbs"
                  name="carbs"
                  min="0"
                  step="5"
                  defaultValue={goals.carbs}
                  required
                />
                <span className="unit">g</span>
              </div>
            </div>

            <div className="goal-card">
              <div className="goal-header">
                <div className="goal-icon fat-icon">🥑</div>
                <div className="goal-info">
                  <label htmlFor="fat">Fat</label>
                  <p className="goal-description">Important for hormone production and nutrient absorption</p>
                </div>
              </div>
              <div className="goal-input-wrapper">
                <input
                  type="number"
                  id="fat"
                  name="fat"
                  min="0"
                  step="5"
                  defaultValue={goals.fat}
                  required
                />
                <span className="unit">g</span>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="reset-btn" onClick={handleReset}>
              Reset to Defaults
            </button>
            <button type="submit" className="save-btn">
              {saved ? '✓ Saved!' : 'Save Goals'}
            </button>
          </div>
        </form>

        <div className="info-section">
          <h3>Macro Information</h3>
          <div className="info-cards">
            <div className="info-card">
              <h4>Protein</h4>
              <p>4 calories per gram</p>
              <p className="recommendation">Recommended: 0.8-1.2g per lb of body weight</p>
            </div>
            <div className="info-card">
              <h4>Carbohydrates</h4>
              <p>4 calories per gram</p>
              <p className="recommendation">Recommended: 45-65% of total calories</p>
            </div>
            <div className="info-card">
              <h4>Fat</h4>
              <p>9 calories per gram</p>
              <p className="recommendation">Recommended: 20-35% of total calories</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
