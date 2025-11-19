import type { TechnicalIndicators, PriceHistory } from '../types/crypto'

export class TechnicalIndicatorsCalculator {
  /**
   * Calculate RSI (Relative Strength Index)
   * @param prices Array of historical prices
   * @param period Period for RSI calculation (default: 14)
   */
  static calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) {
      return 50 // Return neutral value if not enough data
    }

    const changes: number[] = []
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1])
    }

    let gains = 0
    let losses = 0

    // Calculate initial average gain and loss
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        gains += changes[i]
      } else {
        losses += Math.abs(changes[i])
      }
    }

    let avgGain = gains / period
    let avgLoss = losses / period

    // Calculate subsequent values using smoothed averages
    for (let i = period; i < changes.length; i++) {
      const change = changes[i]
      const gain = change > 0 ? change : 0
      const loss = change < 0 ? Math.abs(change) : 0

      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
    }

    if (avgLoss === 0) {
      return 100
    }

    const rs = avgGain / avgLoss
    const rsi = 100 - 100 / (1 + rs)

    return rsi
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   * @param prices Array of historical prices
   */
  static calculateMACD(prices: number[]): {
    macd: number
    signal: number
    histogram: number
  } {
    const fastPeriod = 12
    const slowPeriod = 26
    const signalPeriod = 9

    if (prices.length < slowPeriod) {
      return { macd: 0, signal: 0, histogram: 0 }
    }

    const fastEMA = this.calculateEMA(prices, fastPeriod)
    const slowEMA = this.calculateEMA(prices, slowPeriod)

    const macdLine = fastEMA - slowEMA

    // Calculate signal line (EMA of MACD line)
    const macdHistory: number[] = []
    for (let i = slowPeriod; i <= prices.length; i++) {
      const fast = this.calculateEMA(prices.slice(0, i), fastPeriod)
      const slow = this.calculateEMA(prices.slice(0, i), slowPeriod)
      macdHistory.push(fast - slow)
    }

    const signalLine = this.calculateEMA(macdHistory, signalPeriod)
    const histogram = macdLine - signalLine

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram,
    }
  }

  /**
   * Calculate Bollinger Bands
   * @param prices Array of historical prices
   * @param period Period for calculation (default: 20)
   * @param stdDev Standard deviation multiplier (default: 2)
   */
  static calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): {
    upper: number
    middle: number
    lower: number
  } {
    if (prices.length < period) {
      const currentPrice = prices[prices.length - 1] || 0
      return {
        upper: currentPrice,
        middle: currentPrice,
        lower: currentPrice,
      }
    }

    // Calculate SMA (middle band)
    const recentPrices = prices.slice(-period)
    const sma = recentPrices.reduce((sum, price) => sum + price, 0) / period

    // Calculate standard deviation
    const squaredDiffs = recentPrices.map((price) => Math.pow(price - sma, 2))
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / period
    const standardDeviation = Math.sqrt(variance)

    return {
      upper: sma + stdDev * standardDeviation,
      middle: sma,
      lower: sma - stdDev * standardDeviation,
    }
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   * @param prices Array of historical prices
   * @param period Period for EMA calculation
   */
  private static calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) {
      return prices[prices.length - 1] || 0
    }

    const multiplier = 2 / (period + 1)
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period

    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema
    }

    return ema
  }

  /**
   * Calculate all technical indicators for a cryptocurrency
   * @param priceHistory Array of historical price data
   */
  static calculateAllIndicators(priceHistory: PriceHistory[]): TechnicalIndicators {
    const prices = priceHistory.map((p) => p.price)

    return {
      rsi: this.calculateRSI(prices),
      macd: this.calculateMACD(prices),
      bollingerBands: this.calculateBollingerBands(prices),
    }
  }

  /**
   * Calculate volume average
   * @param volumes Array of historical volumes
   * @param period Period for average calculation (default: 24)
   */
  static calculateVolumeAverage(volumes: number[], period: number = 24): number {
    if (volumes.length === 0) return 0

    const recentVolumes = volumes.slice(-period)
    return recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length
  }

  /**
   * Detect if volume is spiking
   * @param currentVolume Current volume
   * @param historicalVolumes Array of historical volumes
   * @param threshold Spike threshold multiplier (default: 2.0 for 200%)
   */
  static isVolumeSpiking(
    currentVolume: number,
    historicalVolumes: number[],
    threshold: number = 2.0
  ): boolean {
    const average = this.calculateVolumeAverage(historicalVolumes)
    return currentVolume >= average * threshold
  }
}
