-- Create meals table
CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein DECIMAL(10, 2) NOT NULL,
  carbs DECIMAL(10, 2) NOT NULL,
  fat DECIMAL(10, 2) NOT NULL,
  meal_date DATE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  calories INTEGER NOT NULL DEFAULT 2000,
  protein INTEGER NOT NULL DEFAULT 150,
  carbs INTEGER NOT NULL DEFAULT 250,
  fat INTEGER NOT NULL DEFAULT 65,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Create policies for meals table
CREATE POLICY "Users can view their own meals"
  ON meals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meals"
  ON meals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meals"
  ON meals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meals"
  ON meals FOR DELETE
  USING (auth.uid() = user_id);

-- Create policies for goals table
CREATE POLICY "Users can view their own goals"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS meals_user_id_idx ON meals(user_id);
CREATE INDEX IF NOT EXISTS meals_meal_date_idx ON meals(meal_date);
CREATE INDEX IF NOT EXISTS goals_user_id_idx ON goals(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_meals_updated_at
  BEFORE UPDATE ON meals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
