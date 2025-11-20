import type { CryptoData, EnhancedCryptoData, NewsArticle, MarketSentiment, PredictiveSignal } from '../types/crypto'
import { newsService } from './newsService'
import { predictiveAnalytics } from './predictiveAnalytics'
import { alertService } from './alertService'

/**
 * Enhanced Crypto Service
 * Enriches cryptocurrency data with news, sentiment, predictive signals, and additional metrics
 */

class EnhancedCryptoService {
  private enhancedDataCache: Map<string, { data: EnhancedCryptoData; timestamp: number }> = new Map()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  // White paper URLs for popular cryptocurrencies
  private whitePaperUrls: Record<string, string> = {
    'bitcoin': 'https://bitcoin.org/bitcoin.pdf',
    'ethereum': 'https://ethereum.org/en/whitepaper/',
    'cardano': 'https://cardano.org/genesis/',
    'polkadot': 'https://polkadot.network/whitepaper/',
    'solana': 'https://solana.com/solana-whitepaper.pdf',
    'avalanche-2': 'https://www.avalabs.org/whitepapers',
    'chainlink': 'https://chain.link/whitepaper',
    'polygon': 'https://polygon.technology/lightpaper-polygon.pdf',
    'uniswap': 'https://uniswap.org/whitepaper-v3.pdf',
    'aave': 'https://github.com/aave/protocol-v2/blob/master/aave-v2-whitepaper.pdf'
  }

  /**
   * Get enhanced cryptocurrency data with all additional information
   */
  async getEnhancedCryptoData(crypto: CryptoData): Promise<EnhancedCryptoData> {
    // Check cache first
    const cached = this.enhancedDataCache.get(crypto.id)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      // Fetch news and sentiment in parallel
      const [news, sentiment] = await Promise.all([
        this.getRecentNews(crypto.id, crypto.symbol),
        newsService.getMarketSentiment(crypto.id, crypto.symbol)
      ])

      // Get predictive signals if we have price history
      const priceHistory = alertService.getPriceHistory(crypto.id)
      let predictiveSignals: PredictiveSignal[] = []

      if (priceHistory.length >= 50) {
        predictiveSignals = predictiveAnalytics.detectPredictiveSignals(priceHistory, crypto.symbol)
      }

      // Get white paper URL
      const whitePaperUrl = this.whitePaperUrls[crypto.id]

      // Calculate whale activity (mock data for now - would need blockchain API)
      const whaleActivity = this.calculateWhaleActivity(crypto)

      // Create enhanced data
      const enhancedData: EnhancedCryptoData = {
        ...crypto,
        sentiment,
        recentNews: news,
        whitePaperUrl,
        predictiveSignals,
        whaleActivity
      }

      // Cache the result
      this.enhancedDataCache.set(crypto.id, {
        data: enhancedData,
        timestamp: Date.now()
      })

      return enhancedData
    } catch (error) {
      console.error('Error enhancing crypto data:', error)
      // Return basic enhanced data on error
      return {
        ...crypto,
        whitePaperUrl: this.whitePaperUrls[crypto.id]
      }
    }
  }

  /**
   * Get recent news for a cryptocurrency (limited to top 3)
   */
  private async getRecentNews(coinId: string, coinSymbol: string): Promise<NewsArticle[]> {
    try {
      const articles = await newsService.fetchNewsForCoin(coinId, coinSymbol)
      return articles.slice(0, 3) // Only return top 3 most relevant/recent
    } catch (error) {
      console.error('Error fetching news:', error)
      return []
    }
  }

  /**
   * Calculate whale activity (placeholder - would need blockchain data APIs)
   */
  private calculateWhaleActivity(crypto: CryptoData): { largeTransactions24h: number; netFlow: number } {
    // In a real implementation, this would query blockchain APIs to track:
    // - Large transactions (>$100k or >1% of circulating supply)
    // - Net exchange inflow/outflow
    // - Whale wallet movements

    // For now, return mock data based on volume
    const volumeRatio = crypto.total_volume / crypto.market_cap

    // Higher volume ratio suggests more whale activity
    const largeTransactions24h = Math.floor(volumeRatio * 100)

    // Positive netFlow = accumulation, negative = distribution
    // Use price change as a proxy
    const netFlow = (crypto.price_change_percentage_24h || 0) > 0
      ? Math.random() * 1000000
      : -Math.random() * 1000000

    return {
      largeTransactions24h,
      netFlow
    }
  }

  /**
   * Get sentiment indicator for quick display
   */
  getSentimentIndicator(sentiment?: MarketSentiment): { emoji: string; label: string; color: string } {
    if (!sentiment) {
      return { emoji: '⚪', label: 'Unknown', color: '#999' }
    }

    switch (sentiment.overall) {
      case 'bullish':
        return { emoji: '🟢', label: 'Bullish', color: '#26a69a' }
      case 'bearish':
        return { emoji: '🔴', label: 'Bearish', color: '#ef5350' }
      default:
        return { emoji: '🟡', label: 'Neutral', color: '#ffa726' }
    }
  }

  /**
   * Format ATH distance for display
   */
  formatATHDistance(currentPrice: number, ath: number): { distance: number; formatted: string } {
    const distance = ((currentPrice - ath) / ath) * 100
    const formatted = distance >= 0
      ? `AT ATH`
      : `${Math.abs(distance).toFixed(1)}% from ATH`

    return { distance, formatted }
  }

  /**
   * Get predictive signal summary
   */
  getPredictiveSignalSummary(signals?: PredictiveSignal[]): string {
    if (!signals || signals.length === 0) {
      return 'No signals'
    }

    const trend = predictiveAnalytics.getPredictiveTrend(signals)
    const confidence = predictiveAnalytics.calculateOverallConfidence(signals)

    if (confidence < 70) {
      return 'Low confidence'
    }

    return `${trend.toUpperCase()} (${confidence.toFixed(0)}%)`
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.enhancedDataCache.clear()
  }

  /**
   * Batch enhance multiple cryptocurrencies
   * Note: This should be used sparingly to avoid rate limiting
   */
  async batchEnhance(cryptoList: CryptoData[], limit: number = 10): Promise<EnhancedCryptoData[]> {
    const toEnhance = cryptoList.slice(0, limit)

    // Enhance in parallel with some concurrency control
    const enhanced: EnhancedCryptoData[] = []

    for (let i = 0; i < toEnhance.length; i += 3) {
      const batch = toEnhance.slice(i, i + 3)
      const results = await Promise.all(
        batch.map(crypto => this.getEnhancedCryptoData(crypto))
      )
      enhanced.push(...results)

      // Small delay between batches to avoid overwhelming APIs
      if (i + 3 < toEnhance.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return enhanced
  }
}

export const enhancedCryptoService = new EnhancedCryptoService()
export default enhancedCryptoService
