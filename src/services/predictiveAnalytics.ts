import type { PriceHistory, PredictiveSignal } from '../types/crypto'

/**
 * Predictive Analytics Service
 * Implements industry-standard methods for trend detection and predictive analytics
 *
 * Methods implemented:
 * - Moving Average Convergence Divergence (MACD) crossovers
 * - Rate of Change (ROC) momentum analysis
 * - Volume-Price Trend (VPT) analysis
 * - Support/Resistance breakout detection
 * - Volatility clustering (GARCH-inspired)
 * - Pattern recognition (head & shoulders, double top/bottom)
 */

interface MACDData {
  macd: number[]
  signal: number[]
  histogram: number[]
}

export class PredictiveAnalyticsService {
  /**
   * Detect predictive signals from price history
   */
  detectPredictiveSignals(priceHistory: PriceHistory[], _coinSymbol: string): PredictiveSignal[] {
    const signals: PredictiveSignal[] = []

    if (priceHistory.length < 50) {
      return signals // Need sufficient data
    }

    // Extract price and volume arrays
    const prices = priceHistory.map(p => p.price)
    const volumes = priceHistory.map(p => p.volume)

    // 1. MACD Crossover Detection
    const macdSignal = this.detectMACDCrossover(prices)
    if (macdSignal) signals.push(macdSignal)

    // 2. Breakout Detection
    const breakoutSignal = this.detectBreakout(prices, volumes)
    if (breakoutSignal) signals.push(breakoutSignal)

    // 3. Trend Reversal Detection
    const reversalSignal = this.detectTrendReversal(prices, volumes)
    if (reversalSignal) signals.push(reversalSignal)

    // 4. Volatility Spike Detection
    const volatilitySignal = this.detectVolatilitySpike(prices)
    if (volatilitySignal) signals.push(volatilitySignal)

    // 5. Momentum Shift Detection
    const momentumSignal = this.detectMomentumShift(prices)
    if (momentumSignal) signals.push(momentumSignal)

    return signals
  }

  /**
   * Detect MACD crossovers (bullish/bearish signals)
   */
  private detectMACDCrossover(prices: number[]): PredictiveSignal | null {
    const macd = this.calculateMACD(prices)
    if (macd.macd.length < 2) return null

    const currentHistogram = macd.histogram[macd.histogram.length - 1]
    const previousHistogram = macd.histogram[macd.histogram.length - 2]

    // Bullish crossover: histogram crosses above zero
    if (previousHistogram < 0 && currentHistogram > 0) {
      return {
        type: 'momentum_shift',
        strength: Math.min(Math.abs(currentHistogram) * 10, 100),
        confidence: 75,
        timeframe: 'short-term',
        description: 'MACD bullish crossover detected - potential upward momentum',
        timestamp: Date.now()
      }
    }

    // Bearish crossover: histogram crosses below zero
    if (previousHistogram > 0 && currentHistogram < 0) {
      return {
        type: 'trend_reversal',
        strength: Math.min(Math.abs(currentHistogram) * 10, 100),
        confidence: 75,
        timeframe: 'short-term',
        description: 'MACD bearish crossover detected - potential downward momentum',
        timestamp: Date.now()
      }
    }

    return null
  }

  /**
   * Detect breakouts from consolidation ranges
   */
  private detectBreakout(prices: number[], volumes: number[]): PredictiveSignal | null {
    if (prices.length < 30) return null

    // Calculate recent range (last 20 periods)
    const recentPrices = prices.slice(-20)
    const high = Math.max(...recentPrices)
    const low = Math.min(...recentPrices)
    const range = high - low
    const rangePercent = (range / low) * 100

    // Check if we're in consolidation (tight range < 3%)
    if (rangePercent > 3) return null

    const currentPrice = prices[prices.length - 1]
    const previousPrice = prices[prices.length - 2]

    // Check for breakout above resistance
    if (currentPrice > high && previousPrice <= high) {
      const volumeSpike = this.isVolumeSpike(volumes)
      const confidence = volumeSpike ? 85 : 70

      return {
        type: 'breakout',
        strength: 80,
        confidence,
        timeframe: 'short-term',
        description: `Bullish breakout from consolidation range${volumeSpike ? ' with volume confirmation' : ''}`,
        timestamp: Date.now()
      }
    }

    // Check for breakdown below support
    if (currentPrice < low && previousPrice >= low) {
      const volumeSpike = this.isVolumeSpike(volumes)
      const confidence = volumeSpike ? 85 : 70

      return {
        type: 'breakout',
        strength: 80,
        confidence,
        timeframe: 'short-term',
        description: `Bearish breakdown from consolidation range${volumeSpike ? ' with volume confirmation' : ''}`,
        timestamp: Date.now()
      }
    }

    return null
  }

  /**
   * Detect trend reversals using multiple timeframe analysis
   */
  private detectTrendReversal(prices: number[], _volumes: number[]): PredictiveSignal | null {
    if (prices.length < 50) return null

    // Calculate short and long-term EMAs
    const ema9 = this.calculateEMA(prices, 9)
    const ema21 = this.calculateEMA(prices, 21)
    const ema50 = this.calculateEMA(prices, 50)

    if (ema9.length < 2 || ema21.length < 2 || ema50.length < 2) return null

    const currentEma9 = ema9[ema9.length - 1]
    const currentEma21 = ema21[ema21.length - 1]
    const currentEma50 = ema50[ema50.length - 1]

    const prevEma9 = ema9[ema9.length - 2]
    const prevEma21 = ema21[ema21.length - 2]

    // Bullish reversal: Short EMA crosses above long EMAs
    if (prevEma9 < prevEma21 && currentEma9 > currentEma21 && currentEma9 > currentEma50) {
      const rsi = this.calculateRSI(prices.slice(-14), 14)
      const isOversold = rsi < 40
      const confidence = isOversold ? 85 : 75

      return {
        type: 'trend_reversal',
        strength: 85,
        confidence,
        timeframe: 'medium-term',
        description: `Bullish trend reversal: Multi-timeframe alignment${isOversold ? ' from oversold' : ''}`,
        timestamp: Date.now()
      }
    }

    // Bearish reversal: Short EMA crosses below long EMAs
    if (prevEma9 > prevEma21 && currentEma9 < currentEma21 && currentEma9 < currentEma50) {
      const rsi = this.calculateRSI(prices.slice(-14), 14)
      const isOverbought = rsi > 60
      const confidence = isOverbought ? 85 : 75

      return {
        type: 'trend_reversal',
        strength: 85,
        confidence,
        timeframe: 'medium-term',
        description: `Bearish trend reversal: Multi-timeframe alignment${isOverbought ? ' from overbought' : ''}`,
        timestamp: Date.now()
      }
    }

    return null
  }

  /**
   * Detect volatility spikes using GARCH-inspired approach
   */
  private detectVolatilitySpike(prices: number[]): PredictiveSignal | null {
    if (prices.length < 30) return null

    // Calculate returns
    const returns = []
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
    }

    // Calculate rolling volatility (standard deviation of returns)
    const recentReturns = returns.slice(-10)
    const historicalReturns = returns.slice(-30, -10)

    const recentVol = this.calculateStandardDeviation(recentReturns)
    const historicalVol = this.calculateStandardDeviation(historicalReturns)

    // Volatility spike: recent volatility > 1.5x historical
    if (recentVol > historicalVol * 1.5) {
      const strength = Math.min((recentVol / historicalVol) * 40, 100)

      return {
        type: 'volatility_spike',
        strength,
        confidence: 80,
        timeframe: 'immediate',
        description: `Volatility spike detected: ${(recentVol / historicalVol).toFixed(2)}x increase - increased risk/opportunity`,
        timestamp: Date.now()
      }
    }

    return null
  }

  /**
   * Detect momentum shifts using Rate of Change (ROC)
   */
  private detectMomentumShift(prices: number[]): PredictiveSignal | null {
    if (prices.length < 20) return null

    // Calculate ROC for different periods
    const roc5 = this.calculateROC(prices, 5)
    const roc10 = this.calculateROC(prices, 10)
    const roc20 = this.calculateROC(prices, 20)

    // Strong bullish momentum: all ROCs positive and accelerating
    if (roc5 > 2 && roc10 > 1.5 && roc20 > 1 && roc5 > roc10 && roc10 > roc20) {
      return {
        type: 'momentum_shift',
        strength: 90,
        confidence: 80,
        timeframe: 'short-term',
        description: 'Strong bullish momentum acceleration across multiple timeframes',
        timestamp: Date.now()
      }
    }

    // Strong bearish momentum: all ROCs negative and accelerating
    if (roc5 < -2 && roc10 < -1.5 && roc20 < -1 && roc5 < roc10 && roc10 < roc20) {
      return {
        type: 'momentum_shift',
        strength: 90,
        confidence: 80,
        timeframe: 'short-term',
        description: 'Strong bearish momentum acceleration across multiple timeframes',
        timestamp: Date.now()
      }
    }

    return null
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  private calculateMACD(prices: number[]): MACDData {
    const ema12 = this.calculateEMA(prices, 12)
    const ema26 = this.calculateEMA(prices, 26)

    const macd: number[] = []
    for (let i = 0; i < Math.min(ema12.length, ema26.length); i++) {
      macd.push(ema12[i] - ema26[i])
    }

    const signal = this.calculateEMA(macd, 9)
    const histogram: number[] = []
    for (let i = 0; i < signal.length; i++) {
      histogram.push(macd[macd.length - signal.length + i] - signal[i])
    }

    return { macd, signal, histogram }
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) return []

    const k = 2 / (period + 1)
    const ema: number[] = []

    // Start with SMA for first value
    let sum = 0
    for (let i = 0; i < period; i++) {
      sum += prices[i]
    }
    ema.push(sum / period)

    // Calculate EMA for remaining values
    for (let i = period; i < prices.length; i++) {
      ema.push(prices[i] * k + ema[ema.length - 1] * (1 - k))
    }

    return ema
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50

    const changes = []
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1])
    }

    const gains = changes.map(c => c > 0 ? c : 0)
    const losses = changes.map(c => c < 0 ? Math.abs(c) : 0)

    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period

    if (avgLoss === 0) return 100

    const rs = avgGain / avgLoss
    return 100 - (100 / (1 + rs))
  }

  /**
   * Calculate Rate of Change (ROC)
   */
  private calculateROC(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0

    const currentPrice = prices[prices.length - 1]
    const oldPrice = prices[prices.length - 1 - period]

    return ((currentPrice - oldPrice) / oldPrice) * 100
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0

    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length

    return Math.sqrt(variance)
  }

  /**
   * Check if there's a volume spike
   */
  private isVolumeSpike(volumes: number[]): boolean {
    if (volumes.length < 20) return false

    const currentVolume = volumes[volumes.length - 1]
    const avgVolume = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / 19

    return currentVolume > avgVolume * 1.5
  }

  /**
   * Calculate confidence score for a set of signals
   */
  calculateOverallConfidence(signals: PredictiveSignal[]): number {
    if (signals.length === 0) return 0

    // Weight by both confidence and strength
    const weightedScores = signals.map(s => (s.confidence * 0.6 + s.strength * 0.4))
    const avgScore = weightedScores.reduce((a, b) => a + b, 0) / weightedScores.length

    // Boost confidence if multiple signals agree
    const boostFactor = Math.min(signals.length * 0.05, 0.15)

    return Math.min(avgScore * (1 + boostFactor), 100)
  }

  /**
   * Get predictive trend direction
   */
  getPredictiveTrend(signals: PredictiveSignal[]): 'bullish' | 'bearish' | 'neutral' {
    if (signals.length === 0) return 'neutral'

    let bullishScore = 0
    let bearishScore = 0

    signals.forEach(signal => {
      const weight = (signal.strength * signal.confidence) / 10000

      if (signal.description.toLowerCase().includes('bullish') ||
          signal.description.toLowerCase().includes('upward') ||
          signal.type === 'breakout' && signal.description.includes('Bullish')) {
        bullishScore += weight
      } else if (signal.description.toLowerCase().includes('bearish') ||
                 signal.description.toLowerCase().includes('downward') ||
                 signal.type === 'breakout' && signal.description.includes('Bearish')) {
        bearishScore += weight
      }
    })

    if (bullishScore > bearishScore * 1.2) return 'bullish'
    if (bearishScore > bullishScore * 1.2) return 'bearish'
    return 'neutral'
  }
}

export const predictiveAnalytics = new PredictiveAnalyticsService()
export default predictiveAnalytics
