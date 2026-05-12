import type { Alert, AlertConfig, CryptoData, PriceHistory } from '../types/crypto'
import { TechnicalIndicatorsCalculator } from './technicalIndicators'
import { baselineTracker } from './baselineTracker'
import { newsService } from './newsService'
import { predictiveAnalytics } from './predictiveAnalytics'

export class AlertService {
  private priceHistory: Map<string, PriceHistory[]> = new Map()
  private volumeHistory: Map<string, number[]> = new Map()
  private alertHistory: Alert[] = []
  private triggeredAlerts: Map<string, number> = new Map() // coinId_type -> timestamp
  private mutedCoins: Set<string> = new Set()
  private alertCallbacks: ((alert: Alert) => void)[] = []
  private lastAlertMomentum: Map<string, string> = new Map() // coinId -> momentum type

  private readonly PRICE_HISTORY_LIMIT = 1440 // 24 hours at 1-minute (or 4 hours at 10s)
  private readonly VOLUME_HISTORY_LIMIT = 1440
  private readonly ALERT_COOLDOWN = 600000 // 10 minutes (increased to reduce spam)

  /**
   * Add price data to history
   */
  addPriceData(coinId: string, price: number, volume: number, timestamp: number) {
    // Add to local price history
    if (!this.priceHistory.has(coinId)) {
      this.priceHistory.set(coinId, [])
    }
    const history = this.priceHistory.get(coinId)!
    history.push({ price, volume, timestamp })

    // Keep only recent history
    if (history.length > this.PRICE_HISTORY_LIMIT) {
      history.shift()
    }

    // Add to volume history
    if (!this.volumeHistory.has(coinId)) {
      this.volumeHistory.set(coinId, [])
    }
    const volHistory = this.volumeHistory.get(coinId)!
    volHistory.push(volume)

    if (volHistory.length > this.VOLUME_HISTORY_LIMIT) {
      volHistory.shift()
    }

    // Add to baseline tracker for momentum analysis
    baselineTracker.addPriceData(coinId, price, volume, timestamp)

    // Auto-reset baseline if needed
    if (baselineTracker.shouldResetBaseline(coinId, price)) {
      baselineTracker.resetBaseline(coinId, price)
    }
  }

  /**
   * Check if alert can be triggered (not in cooldown)
   */
  private canTriggerAlert(coinId: string, alertType: string): boolean {
    const alertKey = `${coinId}_${alertType}`
    const lastTriggered = this.triggeredAlerts.get(alertKey)

    if (!lastTriggered) {
      return true
    }

    const timeSinceLastAlert = Date.now() - lastTriggered
    return timeSinceLastAlert >= this.ALERT_COOLDOWN
  }

  /**
   * Mark alert as triggered
   */
  private markAlertTriggered(coinId: string, alertType: string) {
    const alertKey = `${coinId}_${alertType}`
    this.triggeredAlerts.set(alertKey, Date.now())
  }

  /**
   * Mute alerts for a specific coin
   */
  muteCoin(coinId: string) {
    this.mutedCoins.add(coinId)
  }

  /**
   * Unmute alerts for a specific coin
   */
  unmuteCoin(coinId: string) {
    this.mutedCoins.delete(coinId)
  }

  /**
   * Check if a coin is muted
   */
  isCoinMuted(coinId: string): boolean {
    return this.mutedCoins.has(coinId)
  }

  /**
   * Check for momentum-based alerts with intelligent spam prevention
   * @param coinData Current cryptocurrency data
   * @param config Alert configuration
   */
  checkForAlerts(coinData: CryptoData, config: AlertConfig): Alert[] {
    const alerts: Alert[] = []

    // Skip if coin is muted
    if (this.mutedCoins.has(coinData.id)) {
      return alerts
    }

    const history = this.priceHistory.get(coinData.id) || []
    const volumeHist = this.volumeHistory.get(coinData.id) || []

    if (history.length < 10) {
      return alerts
    }

    const currentPrice = coinData.current_price
    const currentVolume = coinData.total_volume
    const currentTime = Date.now()

    // Get momentum analysis from baseline tracker
    const trendAnalysis = baselineTracker.analyzeMomentum(coinData.id)
    if (!trendAnalysis) return alerts

    const momentum = trendAnalysis.momentum

    // Get change from baseline
    const baselineChange = baselineTracker.getChangeFromBaseline(coinData.id, currentPrice)

    // ===== MOMENTUM-BASED ALERTS =====

    // 1. PARABOLIC MOVEMENT (Highest priority - rare but critical)
    if (momentum.type === 'parabolic_up' && momentum.confidence >= 70) {
      const alertType = 'parabolic_move'
      if (this.canTriggerAlert(coinData.id, alertType) && this.hasSignificantMomentumChange(coinData.id, alertType)) {
        const alert: Alert = {
          id: `${coinData.id}_${alertType}_${currentTime}`,
          coinId: coinData.id,
          coinSymbol: coinData.symbol.toUpperCase(),
          coinName: coinData.name,
          type: 'price_spike',
          message: momentum.description,
          price: currentPrice,
          priceChange: baselineChange !== null ? (baselineChange / 100) * currentPrice : 0,
          priceChangePercent: baselineChange || 0,
          volume: currentVolume,
          timestamp: currentTime,
          triggered: true,
        }

        alerts.push(alert)
        this.markAlertTriggered(coinData.id, alertType)
        this.lastAlertMomentum.set(coinData.id, alertType)
        this.addToHistory(alert)
      }
    }

    // 2. STRONG UPWARD MOMENTUM (Buy signal)
    if (momentum.type === 'strong_up' && momentum.confidence >= 75) {
      const alertType = 'strong_upward'
      if (this.canTriggerAlert(coinData.id, alertType) && this.hasSignificantMomentumChange(coinData.id, alertType)) {
        const alert: Alert = {
          id: `${coinData.id}_${alertType}_${currentTime}`,
          coinId: coinData.id,
          coinSymbol: coinData.symbol.toUpperCase(),
          coinName: coinData.name,
          type: 'price_spike',
          message: momentum.description,
          price: currentPrice,
          priceChange: baselineChange !== null ? (baselineChange / 100) * currentPrice : 0,
          priceChangePercent: baselineChange || 0,
          volume: currentVolume,
          timestamp: currentTime,
          triggered: true,
        }

        alerts.push(alert)
        this.markAlertTriggered(coinData.id, alertType)
        this.lastAlertMomentum.set(coinData.id, alertType)
        this.addToHistory(alert)
      }
    }

    // 3. STRONG DOWNWARD MOMENTUM (Sell/protect signal)
    if (momentum.type === 'strong_down' && momentum.confidence >= 75) {
      const alertType = 'strong_downward'
      if (this.canTriggerAlert(coinData.id, alertType) && this.hasSignificantMomentumChange(coinData.id, alertType)) {
        const alert: Alert = {
          id: `${coinData.id}_${alertType}_${currentTime}`,
          coinId: coinData.id,
          coinSymbol: coinData.symbol.toUpperCase(),
          coinName: coinData.name,
          type: 'price_spike',
          message: momentum.description,
          price: currentPrice,
          priceChange: baselineChange !== null ? (baselineChange / 100) * currentPrice : 0,
          priceChangePercent: baselineChange || 0,
          volume: currentVolume,
          timestamp: currentTime,
          triggered: true,
        }

        alerts.push(alert)
        this.markAlertTriggered(coinData.id, alertType)
        this.lastAlertMomentum.set(coinData.id, alertType)
        this.addToHistory(alert)
      }
    }

    // 4. VOLUME SPIKE WITH TREND CONFIRMATION (Only alert if aligned with trend)
    if (volumeHist.length >= 24) {
      const isSpike = TechnicalIndicatorsCalculator.isVolumeSpiking(
        currentVolume,
        volumeHist,
        config.volumeSpike / 100
      )

      if (isSpike && (trendAnalysis.shortTerm !== 'neutral' || trendAnalysis.mediumTerm !== 'neutral')) {
        const alertType = 'volume_spike'
        if (this.canTriggerAlert(coinData.id, alertType)) {
          const avgVolume = TechnicalIndicatorsCalculator.calculateVolumeAverage(volumeHist)
          const volumeIncrease = ((currentVolume - avgVolume) / avgVolume) * 100
          const trendDirection = trendAnalysis.shortTerm !== 'neutral' ? trendAnalysis.shortTerm : trendAnalysis.mediumTerm

          const alert: Alert = {
            id: `${coinData.id}_${alertType}_${currentTime}`,
            coinId: coinData.id,
            coinSymbol: coinData.symbol.toUpperCase(),
            coinName: coinData.name,
            type: 'volume_spike',
            message: `📊 VOLUME SPIKE: ${coinData.name} +${volumeIncrease.toFixed(0)}% volume (${trendDirection} trend)`,
            price: currentPrice,
            priceChange: baselineChange !== null ? (baselineChange / 100) * currentPrice : 0,
            priceChangePercent: baselineChange || 0,
            volume: currentVolume,
            volumeChange: volumeIncrease,
            timestamp: currentTime,
            triggered: true,
          }

          alerts.push(alert)
          this.markAlertTriggered(coinData.id, alertType)
          this.addToHistory(alert)
        }
      }
    }

    // 5. RSI EXTREME WITH TREND DIVERGENCE (Reversal signals)
    if (history.length >= 14) {
      const prices = history.map((h) => h.price)
      const rsi = TechnicalIndicatorsCalculator.calculateRSI(prices)

      // RSI Oversold + Bearish trend = Potential reversal up
      if (rsi < config.rsiOversold && trendAnalysis.shortTerm === 'bearish') {
        const alertType = 'rsi_oversold'
        if (this.canTriggerAlert(coinData.id, alertType)) {
          const alert: Alert = {
            id: `${coinData.id}_${alertType}_${currentTime}`,
            coinId: coinData.id,
            coinSymbol: coinData.symbol.toUpperCase(),
            coinName: coinData.name,
            type: 'rsi_oversold',
            message: `💎 OVERSOLD: ${coinData.name} RSI ${rsi.toFixed(1)} - Potential bounce opportunity`,
            price: currentPrice,
            priceChange: baselineChange !== null ? (baselineChange / 100) * currentPrice : 0,
            priceChangePercent: baselineChange || 0,
            volume: currentVolume,
            rsi: rsi,
            timestamp: currentTime,
            triggered: true,
          }

          alerts.push(alert)
          this.markAlertTriggered(coinData.id, alertType)
          this.addToHistory(alert)
        }
      }

      // RSI Overbought + Bullish trend = Take profit signal
      if (rsi > config.rsiOverbought && trendAnalysis.shortTerm === 'bullish') {
        const alertType = 'rsi_overbought'
        if (this.canTriggerAlert(coinData.id, alertType)) {
          const alert: Alert = {
            id: `${coinData.id}_${alertType}_${currentTime}`,
            coinId: coinData.id,
            coinSymbol: coinData.symbol.toUpperCase(),
            coinName: coinData.name,
            type: 'rsi_overbought',
            message: `💰 OVERBOUGHT: ${coinData.name} RSI ${rsi.toFixed(1)} - Consider taking profits`,
            price: currentPrice,
            priceChange: baselineChange !== null ? (baselineChange / 100) * currentPrice : 0,
            priceChangePercent: baselineChange || 0,
            volume: currentVolume,
            rsi: rsi,
            timestamp: currentTime,
            triggered: true,
          }

          alerts.push(alert)
          this.markAlertTriggered(coinData.id, alertType)
          this.addToHistory(alert)
        }
      }
    }

    // Trigger callbacks for new alerts
    alerts.forEach((alert) => {
      this.alertCallbacks.forEach((callback) => callback(alert))
    })

    return alerts
  }

  /**
   * Check if momentum has changed significantly since last alert
   * Prevents duplicate alerts for same momentum type
   */
  private hasSignificantMomentumChange(coinId: string, newMomentumType: string): boolean {
    const lastMomentum = this.lastAlertMomentum.get(coinId)

    // Always allow if different type
    if (!lastMomentum || lastMomentum !== newMomentumType) {
      return true
    }

    // Same type - only allow if enough time has passed (handled by cooldown)
    return false
  }

  /**
   * Subscribe to alert notifications
   */
  onAlert(callback: (alert: Alert) => void): () => void {
    this.alertCallbacks.push(callback)

    // Return unsubscribe function
    return () => {
      const index = this.alertCallbacks.indexOf(callback)
      if (index > -1) {
        this.alertCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Add alert to history
   */
  private addToHistory(alert: Alert) {
    this.alertHistory.unshift(alert)

    // Keep only last 50 alerts
    if (this.alertHistory.length > 50) {
      this.alertHistory.pop()
    }
  }

  /**
   * Get alert history
   */
  getAlertHistory(): Alert[] {
    return [...this.alertHistory]
  }

  /**
   * Clear alert history
   */
  clearAlertHistory() {
    this.alertHistory = []
  }

  /**
   * Clear triggered alerts cache (allows alerts to trigger again)
   */
  clearTriggeredAlerts() {
    this.triggeredAlerts.clear()
  }

  /**
   * Get list of muted coins
   */
  getMutedCoins(): string[] {
    return Array.from(this.mutedCoins)
  }

  /**
   * Get price history for a coin
   */
  getPriceHistory(coinId: string): PriceHistory[] {
    return this.priceHistory.get(coinId) || []
  }

  /**
   * Check for predictive signals and create alerts
   * Uses advanced analytics to detect emerging trends early
   */
  async checkPredictiveSignals(coinData: CryptoData): Promise<Alert[]> {
    const alerts: Alert[] = []

    // Skip if coin is muted
    if (this.mutedCoins.has(coinData.id)) {
      return alerts
    }

    const history = this.priceHistory.get(coinData.id) || []
    if (history.length < 50) {
      return alerts // Need sufficient history for predictions
    }

    // Get predictive signals
    const signals = predictiveAnalytics.detectPredictiveSignals(history, coinData.symbol)

    if (signals.length === 0) {
      return alerts
    }

    // Calculate overall confidence
    const overallConfidence = predictiveAnalytics.calculateOverallConfidence(signals)

    // Only alert on high-confidence signals
    if (overallConfidence < 70) {
      return alerts
    }

    // Group signals by type to avoid spam
    const signalsByType = new Map<string, typeof signals>()
    signals.forEach(signal => {
      const existing = signalsByType.get(signal.type) || []
      existing.push(signal)
      signalsByType.set(signal.type, existing)
    })

    // Create alerts for each signal type
    for (const [type, typeSignals] of signalsByType.entries()) {
      const alertType = `predictive_${type}`
      if (this.canTriggerAlert(coinData.id, alertType)) {
        const bestSignal = typeSignals.reduce((best, current) =>
          current.confidence > best.confidence ? current : best
        )

        const alert: Alert = {
          id: `${coinData.id}_${alertType}_${Date.now()}`,
          coinId: coinData.id,
          coinSymbol: coinData.symbol.toUpperCase(),
          coinName: coinData.name,
          type: type === 'breakout' ? 'price_spike' : type === 'trend_reversal' ? 'price_spike' : 'volume_spike',
          message: `🔮 PREDICTIVE: ${bestSignal.description}`,
          price: coinData.current_price,
          priceChange: coinData.price_change_24h || 0,
          priceChangePercent: coinData.price_change_percentage_24h || 0,
          volume: coinData.total_volume,
          timestamp: Date.now(),
          triggered: true,
          confidence: overallConfidence,
          predictiveScore: bestSignal.strength
        }

        alerts.push(alert)
        this.markAlertTriggered(coinData.id, alertType)
        this.addToHistory(alert)
      }
    }

    // Trigger callbacks
    alerts.forEach((alert) => {
      this.alertCallbacks.forEach((callback) => callback(alert))
    })

    return alerts
  }

  /**
   * Check for news-based alerts
   * Combines news sentiment with price action for high-confidence alerts
   */
  async checkNewsAlerts(coinData: CryptoData): Promise<Alert[]> {
    const alerts: Alert[] = []

    // Skip if coin is muted
    if (this.mutedCoins.has(coinData.id)) {
      return alerts
    }

    try {
      // Fetch news and check if it should trigger alert
      const articles = await newsService.fetchNewsForCoin(coinData.id, coinData.symbol)
      const newsCheck = newsService.shouldTriggerNewsAlert(articles)

      if (!newsCheck.shouldTrigger) {
        return alerts
      }

      // Check if we can trigger this alert (cooldown)
      const alertType = 'news_catalyst'
      if (!this.canTriggerAlert(coinData.id, alertType)) {
        return alerts
      }

      // Get market sentiment
      const sentiment = await newsService.getMarketSentiment(coinData.id, coinData.symbol)

      // Combine news signal with price action for stronger confidence
      const baselineChange = baselineTracker.getChangeFromBaseline(coinData.id, coinData.current_price)
      let confidenceBoost = 0

      // Boost confidence if price action aligns with news sentiment
      if (sentiment.overall === 'bullish' && baselineChange && baselineChange > 2) {
        confidenceBoost = 10
      } else if (sentiment.overall === 'bearish' && baselineChange && baselineChange < -2) {
        confidenceBoost = 10
      }

      const finalConfidence = Math.min(newsCheck.confidence + confidenceBoost, 100)

      const alert: Alert = {
        id: `${coinData.id}_${alertType}_${Date.now()}`,
        coinId: coinData.id,
        coinSymbol: coinData.symbol.toUpperCase(),
        coinName: coinData.name,
        type: 'price_spike',
        message: `📰 NEWS ALERT: ${newsCheck.reason} (${sentiment.overall.toUpperCase()} sentiment)`,
        price: coinData.current_price,
        priceChange: coinData.price_change_24h || 0,
        priceChangePercent: coinData.price_change_percentage_24h || 0,
        volume: coinData.total_volume,
        timestamp: Date.now(),
        triggered: true,
        confidence: finalConfidence,
        newsRelated: true
      }

      alerts.push(alert)
      this.markAlertTriggered(coinData.id, alertType)
      this.addToHistory(alert)

      // Trigger callbacks
      this.alertCallbacks.forEach((callback) => callback(alert))
    } catch (error) {
      console.error('Error checking news alerts:', error)
    }

    return alerts
  }

  /**
   * Comprehensive alert check combining all detection methods
   * This is the main entry point for the enhanced alert system
   */
  async checkAllAlerts(coinData: CryptoData, config: AlertConfig): Promise<Alert[]> {
    const allAlerts: Alert[] = []

    // 1. Traditional technical alerts (existing system)
    const technicalAlerts = this.checkForAlerts(coinData, config)
    allAlerts.push(...technicalAlerts)

    // 2. Predictive analytics alerts (new)
    const predictiveAlerts = await this.checkPredictiveSignals(coinData)
    allAlerts.push(...predictiveAlerts)

    // 3. News-based alerts (new)
    const newsAlerts = await this.checkNewsAlerts(coinData)
    allAlerts.push(...newsAlerts)

    return allAlerts
  }
}

export const alertService = new AlertService()
