import type { CryptoPrice } from '../types/crypto'
import { coinGeckoService } from './coinGeckoService'

export type PriceUpdateCallback = (data: CryptoPrice) => void

class CryptoPricePoller {
  private subscribers: Map<string, Set<PriceUpdateCallback>> = new Map()
  private subscribedCoins: Map<string, string> = new Map() // symbol -> coinId mapping
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private readonly POLL_INTERVAL = 10000 // 10 seconds (respecting CoinGecko rate limits)
  private isPolling = false

  constructor() {
    this.startPolling()
  }

  private startPolling() {
    if (this.isPolling) return

    this.isPolling = true
    console.log('Starting CoinGecko price polling service')

    // Start polling for price updates
    this.pollingInterval = setInterval(async () => {
      await this.pollPrices()
    }, this.POLL_INTERVAL)

    // Initial poll
    this.pollPrices()
  }

  private async pollPrices() {
    if (this.subscribedCoins.size === 0) return

    try {
      const coinIds = Array.from(this.subscribedCoins.values())

      // Fetch updated data for all subscribed coins
      const prices = await coinGeckoService.getMultipleCoinPrices(coinIds)

      // Also get full market data for volume information
      const marketData = await coinGeckoService.getTop100Cryptocurrencies()
      const coinDataMap = new Map(marketData.map(coin => [coin.id, coin]))

      // Notify subscribers
      this.subscribedCoins.forEach((coinId, symbol) => {
        const price = prices[coinId]
        const coinData = coinDataMap.get(coinId)

        if (price !== undefined && coinData) {
          const priceData: CryptoPrice = {
            symbol: symbol.toLowerCase(),
            price: price,
            timestamp: Date.now(),
            volume: coinData.total_volume || 0,
          }

          const callbacks = this.subscribers.get(symbol.toLowerCase())
          if (callbacks) {
            callbacks.forEach((callback) => callback(priceData))
          }
        }
      })
    } catch (error) {
      console.error('Error polling crypto prices:', error)
    }
  }

  subscribe(symbol: string, coinId: string, callback: PriceUpdateCallback): () => void {
    const normalizedSymbol = symbol.toLowerCase()

    if (!this.subscribers.has(normalizedSymbol)) {
      this.subscribers.set(normalizedSymbol, new Set())
    }

    this.subscribers.get(normalizedSymbol)!.add(callback)
    this.subscribedCoins.set(normalizedSymbol, coinId)

    console.log(`Subscribed to ${symbol} (${coinId}) price updates`)

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(normalizedSymbol)
      if (callbacks) {
        callbacks.delete(callback)

        // If no more subscribers for this symbol, remove it
        if (callbacks.size === 0) {
          this.subscribers.delete(normalizedSymbol)
          this.subscribedCoins.delete(normalizedSymbol)
          console.log(`Unsubscribed from ${symbol} price updates`)
        }
      }
    }
  }

  disconnect() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }

    this.subscribers.clear()
    this.subscribedCoins.clear()
    this.isPolling = false
    console.log('Price polling service stopped')
  }

  isConnected(): boolean {
    return this.isPolling
  }
}

export const cryptoPricePoller = new CryptoPricePoller()
