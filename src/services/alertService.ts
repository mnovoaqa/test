import type { Alert, AlertConfig, CryptoData, PriceHistory } from '../types/crypto'
import { TechnicalIndicatorsCalculator } from './technicalIndicators'

export class AlertService {
  private priceHistory: Map<string, PriceHistory[]> = new Map()
  private volumeHistory: Map<string, number[]> = new Map()
  private alertHistory: Alert[] = []
  private triggeredAlerts: Map<string, number> = new Map() // coinId_type -> timestamp
  private mutedCoins: Set<string> = new Set()
  private alertCallbacks: ((alert: Alert) => void)[] = []

  private readonly PRICE_HISTORY_LIMIT = 100
  private readonly VOLUME_HISTORY_LIMIT = 100
  private readonly ALERT_COOLDOWN = 300000 // 5 minutes in milliseconds

  /**
   * Add price data to history
   */
  addPriceData(coinId: string, price: number, volume: number, timestamp: number) {
    // Add to price history
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
   * Check for parabolic price movement
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

    if (history.length < 2) {
      return alerts
    }

    const currentPrice = coinData.current_price
    const currentVolume = coinData.total_volume
    const currentTime = Date.now()

    // Check price spike (3% in 5 minutes)
    const timeWindow = config.priceChangeWindow * 60 * 1000 // Convert to ms
    const recentHistory = history.filter(
      (h) => currentTime - h.timestamp <= timeWindow
    )

    if (recentHistory.length > 0) {
      const oldestPrice = recentHistory[0].price
      const priceChange = currentPrice - oldestPrice
      const priceChangePercent = (priceChange / oldestPrice) * 100

      if (Math.abs(priceChangePercent) >= config.priceChangeThreshold) {
        if (this.canTriggerAlert(coinData.id, 'price_spike')) {
          const alert: Alert = {
            id: `${coinData.id}_price_${currentTime}`,
            coinId: coinData.id,
            coinSymbol: coinData.symbol.toUpperCase(),
            coinName: coinData.name,
            type: 'price_spike',
            message: `${coinData.name} (${coinData.symbol.toUpperCase()}) ${
              priceChangePercent > 0 ? 'surged' : 'dropped'
            } ${Math.abs(priceChangePercent).toFixed(2)}% in ${config.priceChangeWindow} minutes!`,
            price: currentPrice,
            priceChange: priceChange,
            priceChangePercent: priceChangePercent,
            volume: currentVolume,
            timestamp: currentTime,
            triggered: true,
          }

          alerts.push(alert)
          this.markAlertTriggered(coinData.id, 'price_spike')
          this.addToHistory(alert)
        }
      }
    }

    // Check volume spike (200% above average)
    if (volumeHist.length >= 24) {
      const isSpike = TechnicalIndicatorsCalculator.isVolumeSpiking(
        currentVolume,
        volumeHist,
        config.volumeSpike / 100
      )

      if (isSpike) {
        if (this.canTriggerAlert(coinData.id, 'volume_spike')) {
          const avgVolume = TechnicalIndicatorsCalculator.calculateVolumeAverage(volumeHist)
          const volumeIncrease = ((currentVolume - avgVolume) / avgVolume) * 100

          const alert: Alert = {
            id: `${coinData.id}_volume_${currentTime}`,
            coinId: coinData.id,
            coinSymbol: coinData.symbol.toUpperCase(),
            coinName: coinData.name,
            type: 'volume_spike',
            message: `${coinData.name} (${coinData.symbol.toUpperCase()}) volume spiked ${volumeIncrease.toFixed(
              0
            )}% above average!`,
            price: currentPrice,
            priceChange: coinData.price_change_24h,
            priceChangePercent: coinData.price_change_percentage_24h,
            volume: currentVolume,
            volumeChange: volumeIncrease,
            timestamp: currentTime,
            triggered: true,
          }

          alerts.push(alert)
          this.markAlertTriggered(coinData.id, 'volume_spike')
          this.addToHistory(alert)
        }
      }
    }

    // Check RSI indicators
    if (history.length >= 14) {
      const prices = history.map((h) => h.price)
      const rsi = TechnicalIndicatorsCalculator.calculateRSI(prices)

      // RSI Oversold
      if (rsi < config.rsiOversold) {
        if (this.canTriggerAlert(coinData.id, 'rsi_oversold')) {
          const alert: Alert = {
            id: `${coinData.id}_rsi_oversold_${currentTime}`,
            coinId: coinData.id,
            coinSymbol: coinData.symbol.toUpperCase(),
            coinName: coinData.name,
            type: 'rsi_oversold',
            message: `${coinData.name} (${coinData.symbol.toUpperCase()}) is oversold! RSI: ${rsi.toFixed(
              2
            )}`,
            price: currentPrice,
            priceChange: coinData.price_change_24h,
            priceChangePercent: coinData.price_change_percentage_24h,
            volume: currentVolume,
            rsi: rsi,
            timestamp: currentTime,
            triggered: true,
          }

          alerts.push(alert)
          this.markAlertTriggered(coinData.id, 'rsi_oversold')
          this.addToHistory(alert)
        }
      }

      // RSI Overbought
      if (rsi > config.rsiOverbought) {
        if (this.canTriggerAlert(coinData.id, 'rsi_overbought')) {
          const alert: Alert = {
            id: `${coinData.id}_rsi_overbought_${currentTime}`,
            coinId: coinData.id,
            coinSymbol: coinData.symbol.toUpperCase(),
            coinName: coinData.name,
            type: 'rsi_overbought',
            message: `${coinData.name} (${coinData.symbol.toUpperCase()}) is overbought! RSI: ${rsi.toFixed(
              2
            )}`,
            price: currentPrice,
            priceChange: coinData.price_change_24h,
            priceChangePercent: coinData.price_change_percentage_24h,
            volume: currentVolume,
            rsi: rsi,
            timestamp: currentTime,
            triggered: true,
          }

          alerts.push(alert)
          this.markAlertTriggered(coinData.id, 'rsi_overbought')
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
}

export const alertService = new AlertService()
