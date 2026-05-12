import axios, { type AxiosInstance } from 'axios'
import type { CryptoData } from '../types/crypto'

class CoinGeckoService {
  private api: AxiosInstance
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 30000 // 30 seconds
  private readonly MAX_REQUESTS_PER_MINUTE = 50
  private requestCount = 0
  private resetTimeout: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.api = axios.create({
      baseURL: 'https://api.coingecko.com/api/v3',
      timeout: 10000,
    })

    // Request interceptor for rate limiting
    this.api.interceptors.request.use(async (config) => {
      await this.checkRateLimit()
      return config
    })
  }

  private async checkRateLimit() {
    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      // Wait for rate limit to reset
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    this.requestCount++

    if (!this.resetTimeout) {
      this.resetTimeout = setTimeout(() => {
        this.requestCount = 0
        this.resetTimeout = null
      }, 60000)
    }
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }
    return null
  }

  private setCachedData(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  async getTop100Cryptocurrencies(): Promise<CryptoData[]> {
    const cacheKey = 'top100'
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const response = await this.api.get('/coins/markets', {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 100,
          page: 1,
          sparkline: false,
          price_change_percentage: '1h,24h,7d',
        },
      })

      const data = response.data
      this.setCachedData(cacheKey, data)
      return data
    } catch (error) {
      console.error('Error fetching top 100 cryptocurrencies:', error)
      // Return cached data if available, even if expired
      const cached = this.cache.get(cacheKey)
      if (cached) return cached.data
      throw error
    }
  }

  async getCryptocurrencyById(id: string): Promise<CryptoData> {
    const cacheKey = `crypto_${id}`
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const response = await this.api.get(`/coins/markets`, {
        params: {
          vs_currency: 'usd',
          ids: id,
          order: 'market_cap_desc',
          sparkline: false,
          price_change_percentage: '1h,24h,7d',
        },
      })

      const data = response.data[0]
      this.setCachedData(cacheKey, data)
      return data
    } catch (error) {
      console.error(`Error fetching cryptocurrency ${id}:`, error)
      throw error
    }
  }

  async getHistoricalData(
    coinId: string,
    days: number = 30
  ): Promise<{ prices: number[][]; volumes: number[][] }> {
    const cacheKey = `history_${coinId}_${days}`
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const response = await this.api.get(`/coins/${coinId}/market_chart`, {
        params: {
          vs_currency: 'usd',
          days: days,
          interval: days > 1 ? 'daily' : 'hourly',
        },
      })

      const data = {
        prices: response.data.prices,
        volumes: response.data.total_volumes,
      }
      this.setCachedData(cacheKey, data)
      return data
    } catch (error) {
      console.error(`Error fetching historical data for ${coinId}:`, error)
      throw error
    }
  }

  async searchCryptocurrencies(query: string): Promise<any[]> {
    try {
      const response = await this.api.get('/search', {
        params: { query },
      })
      return response.data.coins
    } catch (error) {
      console.error('Error searching cryptocurrencies:', error)
      throw error
    }
  }

  // Get real-time prices for multiple coins (fallback when WebSocket fails)
  async getMultipleCoinPrices(coinIds: string[]): Promise<Record<string, number>> {
    const cacheKey = `prices_${coinIds.join(',')}`
    const cached = this.getCachedData(cacheKey)
    if (cached) return cached

    try {
      const response = await this.api.get('/simple/price', {
        params: {
          ids: coinIds.join(','),
          vs_currencies: 'usd',
        },
      })

      const prices: Record<string, number> = {}
      Object.entries(response.data).forEach(([coinId, data]: [string, any]) => {
        prices[coinId] = data.usd
      })

      this.setCachedData(cacheKey, prices)
      return prices
    } catch (error) {
      console.error('Error fetching multiple coin prices:', error)
      throw error
    }
  }

  clearCache() {
    this.cache.clear()
  }
}

export const coinGeckoService = new CoinGeckoService()
