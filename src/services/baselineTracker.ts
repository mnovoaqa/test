import type { PriceHistory } from '../types/crypto'

/**
 * Baseline price tracking system
 * Maintains persistent baseline prices for accurate percentage change calculations
 * and momentum detection for meaningful alerts
 */

export interface BaselinePrice {
  coinId: string
  price: number
  timestamp: number
  type: 'initial' | 'reset' | 'significant_move' | 'session_start'
}

export interface MomentumSignal {
  type: 'parabolic_up' | 'strong_up' | 'strong_down' | 'consolidation' | 'neutral'
  strength: number // 0-100
  confidence: number // 0-100
  description: string
}

export interface TrendAnalysis {
  shortTerm: 'bullish' | 'bearish' | 'neutral' // Last 15 minutes
  mediumTerm: 'bullish' | 'bearish' | 'neutral' // Last 1 hour
  longTerm: 'bullish' | 'bearish' | 'neutral' // Last 4 hours
  momentum: MomentumSignal
}

class BaselineTracker {
  private baselines: Map<string, BaselinePrice> = new Map()
  private priceHistory: Map<string, PriceHistory[]> = new Map()

  // Increased history limits for better trend analysis
  private readonly PRICE_HISTORY_LIMIT = 1440 // 24 hours at 1-minute intervals (or 4 hours at 10-second intervals)
  private readonly STORAGE_KEY = 'crypto_baselines'

  // Momentum detection thresholds
  private readonly PARABOLIC_THRESHOLD = 5 // 5% in short timeframe
  private readonly STRONG_MOVE_THRESHOLD = 3 // 3% in medium timeframe
  private readonly CONSOLIDATION_THRESHOLD = 0.5 // < 0.5% movement

  constructor() {
    this.loadBaselines()
  }

  /**
   * Load baselines from localStorage
   */
  private loadBaselines() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.baselines = new Map(Object.entries(data))
        console.log(`Loaded ${this.baselines.size} baseline prices from storage`)
      }
    } catch (error) {
      console.error('Error loading baselines:', error)
    }
  }

  /**
   * Save baselines to localStorage
   */
  private saveBaselines() {
    try {
      const data = Object.fromEntries(this.baselines)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Error saving baselines:', error)
    }
  }

  /**
   * Set or update baseline price for a coin
   */
  setBaseline(
    coinId: string,
    price: number,
    type: BaselinePrice['type'] = 'initial'
  ) {
    const baseline: BaselinePrice = {
      coinId,
      price,
      timestamp: Date.now(),
      type,
    }

    this.baselines.set(coinId, baseline)
    this.saveBaselines()

    console.log(`Set baseline for ${coinId}: $${price.toFixed(6)} (${type})`)
  }

  /**
   * Get baseline price for a coin
   */
  getBaseline(coinId: string): BaselinePrice | null {
    return this.baselines.get(coinId) || null
  }

  /**
   * Calculate percentage change from baseline
   */
  getChangeFromBaseline(coinId: string, currentPrice: number): number | null {
    const baseline = this.baselines.get(coinId)
    if (!baseline) return null

    return ((currentPrice - baseline.price) / baseline.price) * 100
  }

  /**
   * Add price data to history
   */
  addPriceData(coinId: string, price: number, volume: number, timestamp: number) {
    if (!this.priceHistory.has(coinId)) {
      this.priceHistory.set(coinId, [])
    }

    const history = this.priceHistory.get(coinId)!
    history.push({ price, volume, timestamp })

    // Keep only recent history
    if (history.length > this.PRICE_HISTORY_LIMIT) {
      history.shift()
    }

    // Set initial baseline if not exists
    if (!this.baselines.has(coinId)) {
      this.setBaseline(coinId, price, 'initial')
    }
  }

  /**
   * Get price history for a coin
   */
  getPriceHistory(coinId: string): PriceHistory[] {
    return this.priceHistory.get(coinId) || []
  }

  /**
   * Analyze momentum and trend
   */
  analyzeMomentum(coinId: string): TrendAnalysis | null {
    const history = this.priceHistory.get(coinId)
    if (!history || history.length < 10) return null

    const now = Date.now()

    // Time windows (in milliseconds)
    const shortWindow = 15 * 60 * 1000 // 15 minutes
    const mediumWindow = 60 * 60 * 1000 // 1 hour
    const longWindow = 4 * 60 * 60 * 1000 // 4 hours

    // Get prices for different timeframes
    const shortHistory = history.filter(h => now - h.timestamp <= shortWindow)
    const mediumHistory = history.filter(h => now - h.timestamp <= mediumWindow)
    const longHistory = history.filter(h => now - h.timestamp <= longWindow)

    // Calculate trends
    const shortTrend = this.calculateTrend(shortHistory)
    const mediumTrend = this.calculateTrend(mediumHistory)
    const longTrend = this.calculateTrend(longHistory)

    // Detect momentum signal
    const momentum = this.detectMomentum(shortHistory, mediumHistory, longHistory)

    return {
      shortTerm: shortTrend,
      mediumTerm: mediumTrend,
      longTerm: longTrend,
      momentum,
    }
  }

  /**
   * Calculate trend direction for a price history
   */
  private calculateTrend(history: PriceHistory[]): 'bullish' | 'bearish' | 'neutral' {
    if (history.length < 2) return 'neutral'

    const firstPrice = history[0].price
    const lastPrice = history[history.length - 1].price
    const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100

    if (changePercent > 1) return 'bullish'
    if (changePercent < -1) return 'bearish'
    return 'neutral'
  }

  /**
   * Detect momentum signals
   */
  private detectMomentum(
    shortHistory: PriceHistory[],
    mediumHistory: PriceHistory[],
    longHistory: PriceHistory[]
  ): MomentumSignal {
    if (shortHistory.length < 2) {
      return {
        type: 'neutral',
        strength: 0,
        confidence: 0,
        description: 'Insufficient data',
      }
    }

    const currentPrice = shortHistory[shortHistory.length - 1].price

    // Calculate short-term change (15 min)
    const shortChange = ((currentPrice - shortHistory[0].price) / shortHistory[0].price) * 100

    // Calculate medium-term change (1 hour) if available
    let mediumChange = 0
    if (mediumHistory.length >= 2) {
      mediumChange = ((currentPrice - mediumHistory[0].price) / mediumHistory[0].price) * 100
    }

    // Calculate long-term change (4 hours) for trend confirmation
    let longChange = 0
    let hasLongTrend = false
    if (longHistory.length >= 2) {
      longChange = ((currentPrice - longHistory[0].price) / longHistory[0].price) * 100
      hasLongTrend = true
    }

    // Calculate velocity (acceleration of price movement)
    const velocity = this.calculateVelocity(shortHistory)

    // Detect parabolic movement (rapid acceleration)
    if (Math.abs(shortChange) >= this.PARABOLIC_THRESHOLD && velocity > 1.5) {
      const isUp = shortChange > 0
      // Boost confidence if long-term trend aligns
      let confidence = Math.min(100, 70 + velocity * 10)
      if (hasLongTrend && ((isUp && longChange > 0) || (!isUp && longChange < 0))) {
        confidence = Math.min(100, confidence + 10)
      }

      return {
        type: 'parabolic_up',
        strength: Math.min(100, Math.abs(shortChange) * 10),
        confidence,
        description: isUp
          ? `🚀 PARABOLIC: +${shortChange.toFixed(2)}% in 15 min - Strong buying pressure`
          : `⚠️ CRASH: ${shortChange.toFixed(2)}% in 15 min - Panic selling`,
      }
    }

    // Strong upward momentum
    if (shortChange >= this.STRONG_MOVE_THRESHOLD && mediumChange >= this.STRONG_MOVE_THRESHOLD / 2) {
      // Boost confidence if long-term trend is also bullish
      let confidence = 80
      if (hasLongTrend && longChange > 1) {
        confidence = 90
      }

      return {
        type: 'strong_up',
        strength: Math.min(100, Math.abs(shortChange) * 15),
        confidence,
        description: `📈 STRONG BUY: +${shortChange.toFixed(2)}% - Consider entry`,
      }
    }

    // Strong downward momentum
    if (shortChange <= -this.STRONG_MOVE_THRESHOLD && mediumChange <= -this.STRONG_MOVE_THRESHOLD / 2) {
      // Boost confidence if long-term trend is also bearish
      let confidence = 80
      if (hasLongTrend && longChange < -1) {
        confidence = 90
      }

      return {
        type: 'strong_down',
        strength: Math.min(100, Math.abs(shortChange) * 15),
        confidence,
        description: `📉 STRONG SELL: ${shortChange.toFixed(2)}% - Protect capital`,
      }
    }

    // Consolidation (low volatility)
    if (Math.abs(shortChange) < this.CONSOLIDATION_THRESHOLD) {
      return {
        type: 'consolidation',
        strength: 20,
        confidence: 60,
        description: `💤 Consolidating around $${currentPrice.toFixed(2)}`,
      }
    }

    // Neutral
    return {
      type: 'neutral',
      strength: 40,
      confidence: 50,
      description: `➡️ Neutral: ${shortChange >= 0 ? '+' : ''}${shortChange.toFixed(2)}% - No clear signal`,
    }
  }

  /**
   * Calculate velocity (rate of price change acceleration)
   */
  private calculateVelocity(history: PriceHistory[]): number {
    if (history.length < 3) return 0

    const segment1 = history.slice(0, Math.floor(history.length / 2))
    const segment2 = history.slice(Math.floor(history.length / 2))

    if (segment1.length < 2 || segment2.length < 2) return 0

    const change1 = ((segment1[segment1.length - 1].price - segment1[0].price) / segment1[0].price) * 100
    const change2 = ((segment2[segment2.length - 1].price - segment2[0].price) / segment2[0].price) * 100

    // Velocity is the ratio of recent change to earlier change
    if (Math.abs(change1) < 0.1) return 0
    return Math.abs(change2 / change1)
  }

  /**
   * Should reset baseline? (After significant move)
   */
  shouldResetBaseline(coinId: string, currentPrice: number): boolean {
    const baseline = this.baselines.get(coinId)
    if (!baseline) return false

    const changePercent = Math.abs(((currentPrice - baseline.price) / baseline.price) * 100)
    const timeSinceBaseline = Date.now() - baseline.timestamp
    const fourHours = 4 * 60 * 60 * 1000

    // Reset baseline after:
    // 1. Large move (>10%) or
    // 2. 4 hours elapsed
    return changePercent > 10 || timeSinceBaseline > fourHours
  }

  /**
   * Reset baseline to current price
   */
  resetBaseline(coinId: string, currentPrice: number) {
    this.setBaseline(coinId, currentPrice, 'reset')
  }

  /**
   * Clear all baselines (useful for fresh start)
   */
  clearAllBaselines() {
    this.baselines.clear()
    this.saveBaselines()
    console.log('Cleared all baselines')
  }

  /**
   * Get all baselines
   */
  getAllBaselines(): Map<string, BaselinePrice> {
    return new Map(this.baselines)
  }
}

export const baselineTracker = new BaselineTracker()
