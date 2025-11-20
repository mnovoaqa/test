import axios from 'axios'
import type { NewsArticle, MarketSentiment } from '../types/crypto'

/**
 * News Service with Sentiment Analysis
 * Integrates multiple news sources and performs sentiment analysis
 */

class NewsService {
  private cache: Map<string, { data: NewsArticle[]; timestamp: number }> = new Map()
  private sentimentCache: Map<string, { data: MarketSentiment; timestamp: number }> = new Map()
  private CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  // Sentiment analysis keyword dictionaries
  private positiveKeywords = [
    'surge', 'rally', 'gain', 'bull', 'bullish', 'soar', 'breakthrough', 'adoption',
    'partnership', 'upgrade', 'launch', 'success', 'growth', 'profit', 'milestone',
    'innovation', 'breakthrough', 'expand', 'integrate', 'accelerate', 'momentum',
    'optimistic', 'positive', 'strong', 'record', 'high', 'boost', 'advance'
  ]

  private negativeKeywords = [
    'crash', 'fall', 'plunge', 'bear', 'bearish', 'decline', 'drop', 'hack',
    'scam', 'fraud', 'regulation', 'ban', 'lawsuit', 'concern', 'warning',
    'risk', 'loss', 'panic', 'sell-off', 'collapse', 'threat', 'vulnerability',
    'negative', 'weak', 'low', 'dump', 'fear', 'crisis', 'problem'
  ]

  /**
   * Fetch news for a specific cryptocurrency
   */
  async fetchNewsForCoin(coinId: string, coinSymbol: string): Promise<NewsArticle[]> {
    // Check cache first
    const cached = this.cache.get(coinId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      // Fetch from multiple sources and combine
      const articles = await this.fetchFromMultipleSources(coinSymbol)

      // Enhance with sentiment analysis
      const enhancedArticles = articles.map(article => ({
        ...article,
        coinId,
        coinSymbol,
        sentiment: this.analyzeSentiment(article.title + ' ' + article.description).sentiment,
        sentimentScore: this.analyzeSentiment(article.title + ' ' + article.description).score,
        relevanceScore: this.calculateRelevance(article, coinSymbol)
      }))

      // Cache the results
      this.cache.set(coinId, {
        data: enhancedArticles,
        timestamp: Date.now()
      })

      return enhancedArticles
    } catch (error) {
      console.error('Error fetching news:', error)
      return []
    }
  }

  /**
   * Fetch from multiple news sources
   */
  private async fetchFromMultipleSources(coinSymbol: string): Promise<Omit<NewsArticle, 'coinId' | 'coinSymbol' | 'sentiment' | 'sentimentScore' | 'relevanceScore'>[]> {
    const articles: Omit<NewsArticle, 'coinId' | 'coinSymbol' | 'sentiment' | 'sentimentScore' | 'relevanceScore'>[] = []

    // Source 1: CryptoPanic API (free, crypto-specific)
    try {
      const cryptoPanicArticles = await this.fetchFromCryptoPanic(coinSymbol)
      articles.push(...cryptoPanicArticles)
    } catch (error) {
      console.warn('CryptoPanic fetch failed:', error)
    }

    // Source 2: CoinGecko news (if available)
    try {
      const coinGeckoArticles = await this.fetchFromCoinGecko(coinSymbol)
      articles.push(...coinGeckoArticles)
    } catch (error) {
      console.warn('CoinGecko news fetch failed:', error)
    }

    // Source 3: Mock aggregated crypto news for demo
    if (articles.length === 0) {
      articles.push(...this.getMockNews(coinSymbol))
    }

    return articles.slice(0, 10) // Limit to 10 most recent
  }

  /**
   * Fetch from CryptoPanic API
   */
  private async fetchFromCryptoPanic(coinSymbol: string): Promise<Omit<NewsArticle, 'coinId' | 'coinSymbol' | 'sentiment' | 'sentimentScore' | 'relevanceScore'>[]> {
    try {
      // CryptoPanic free API endpoint (no auth required for public feed)
      const response = await axios.get(`https://cryptopanic.com/api/v1/posts/?currencies=${coinSymbol}&public=true`, {
        timeout: 5000
      })

      if (response.data && response.data.results) {
        return response.data.results.map((item: any) => ({
          id: item.id || `cp-${Date.now()}-${Math.random()}`,
          title: item.title,
          description: item.title, // CryptoPanic doesn't provide separate descriptions
          url: item.url,
          source: item.source?.title || 'CryptoPanic',
          publishedAt: item.published_at || new Date().toISOString()
        }))
      }
    } catch (error) {
      // Fail silently and try other sources
    }

    return []
  }

  /**
   * Fetch from CoinGecko (if they have news API)
   */
  private async fetchFromCoinGecko(_coinSymbol: string): Promise<Omit<NewsArticle, 'coinId' | 'coinSymbol' | 'sentiment' | 'sentimentScore' | 'relevanceScore'>[]> {
    // CoinGecko doesn't have a public news API, but this is a placeholder for future integration
    return []
  }

  /**
   * Get mock news data for demonstration
   */
  private getMockNews(_coinSymbol: string): Omit<NewsArticle, 'coinId' | 'coinSymbol' | 'sentiment' | 'sentimentScore' | 'relevanceScore'>[] {
    const templates = [
      {
        title: `${_coinSymbol} shows strong momentum amid institutional interest`,
        description: 'Major institutions continue to accumulate positions, driving positive sentiment in the market.',
        source: 'Crypto News',
        searchQuery: `${_coinSymbol} cryptocurrency institutional interest news`
      },
      {
        title: `Technical analysis: ${_coinSymbol} approaching key resistance level`,
        description: 'Analysts are watching closely as the cryptocurrency nears a critical price point that could signal a breakout.',
        source: 'Trading View',
        searchQuery: `${_coinSymbol} technical analysis price prediction`
      },
      {
        title: `${_coinSymbol} network upgrade scheduled for next month`,
        description: 'Developers announce upcoming improvements that could enhance scalability and transaction speeds.',
        source: 'Coin Telegraph',
        searchQuery: `${_coinSymbol} network upgrade development news`
      },
      {
        title: `Market volatility: ${_coinSymbol} experiences increased trading volume`,
        description: 'Trading activity surges as market participants react to recent macroeconomic developments.',
        source: 'Crypto Briefing',
        searchQuery: `${_coinSymbol} trading volume market analysis`
      }
    ]

    return templates.map((template, index) => ({
      id: `mock-${_coinSymbol}-${index}`,
      title: template.title,
      description: template.description,
      url: `https://www.google.com/search?q=${encodeURIComponent(template.searchQuery)}`,
      source: template.source,
      publishedAt: new Date(Date.now() - index * 3600000).toISOString() // Stagger by hours
    }))
  }

  /**
   * Analyze sentiment of text using keyword-based approach
   * More advanced: Could integrate with NLP APIs like AWS Comprehend, Google NLP, or HuggingFace
   */
  private analyzeSentiment(text: string): { sentiment: 'positive' | 'negative' | 'neutral'; score: number } {
    const lowerText = text.toLowerCase()

    let positiveCount = 0
    let negativeCount = 0

    // Count positive keywords
    this.positiveKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      const matches = lowerText.match(regex)
      if (matches) positiveCount += matches.length
    })

    // Count negative keywords
    this.negativeKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      const matches = lowerText.match(regex)
      if (matches) negativeCount += matches.length
    })

    // Calculate sentiment score (-100 to 100)
    const totalKeywords = positiveCount + negativeCount
    if (totalKeywords === 0) {
      return { sentiment: 'neutral', score: 0 }
    }

    const score = ((positiveCount - negativeCount) / totalKeywords) * 100

    // Determine sentiment category
    let sentiment: 'positive' | 'negative' | 'neutral'
    if (score > 20) {
      sentiment = 'positive'
    } else if (score < -20) {
      sentiment = 'negative'
    } else {
      sentiment = 'neutral'
    }

    return { sentiment, score }
  }

  /**
   * Calculate relevance score based on how well the article matches the coin
   */
  private calculateRelevance(article: Omit<NewsArticle, 'coinId' | 'coinSymbol' | 'sentiment' | 'sentimentScore' | 'relevanceScore'>, coinSymbol: string): number {
    const text = (article.title + ' ' + article.description).toLowerCase()
    const symbolLower = coinSymbol.toLowerCase()

    // Count mentions of the coin symbol
    const symbolRegex = new RegExp(`\\b${symbolLower}\\b`, 'gi')
    const mentions = text.match(symbolRegex)?.length || 0

    // Higher relevance for more mentions and recency
    const recencyScore = this.calculateRecencyScore(article.publishedAt)
    const mentionScore = Math.min(mentions * 30, 70) // Max 70 from mentions

    return Math.min(mentionScore + recencyScore, 100)
  }

  /**
   * Calculate recency score (0-30 based on how recent the article is)
   */
  private calculateRecencyScore(publishedAt: string): number {
    const published = new Date(publishedAt).getTime()
    const now = Date.now()
    const hoursSince = (now - published) / (1000 * 60 * 60)

    if (hoursSince < 1) return 30
    if (hoursSince < 6) return 25
    if (hoursSince < 24) return 20
    if (hoursSince < 72) return 10
    return 5
  }

  /**
   * Get aggregated market sentiment for a coin
   */
  async getMarketSentiment(coinId: string, coinSymbol: string): Promise<MarketSentiment> {
    // Check cache
    const cached = this.sentimentCache.get(coinId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }

    try {
      // Fetch recent news
      const articles = await this.fetchNewsForCoin(coinId, coinSymbol)

      // Calculate overall sentiment
      const sentimentScores = articles.map(a => a.sentimentScore)
      const avgSentiment = sentimentScores.length > 0
        ? sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length
        : 0

      let overall: 'bullish' | 'bearish' | 'neutral'
      if (avgSentiment > 20) {
        overall = 'bullish'
      } else if (avgSentiment < -20) {
        overall = 'bearish'
      } else {
        overall = 'neutral'
      }

      const sentiment: MarketSentiment = {
        coinId,
        overall,
        score: Math.round(avgSentiment),
        newsCount24h: articles.filter(a => {
          const hoursSince = (Date.now() - new Date(a.publishedAt).getTime()) / (1000 * 60 * 60)
          return hoursSince < 24
        }).length,
        socialMentions24h: Math.floor(Math.random() * 1000), // Placeholder - would need Twitter/Reddit API
        lastUpdated: Date.now()
      }

      // Cache the result
      this.sentimentCache.set(coinId, {
        data: sentiment,
        timestamp: Date.now()
      })

      return sentiment
    } catch (error) {
      console.error('Error calculating sentiment:', error)

      // Return neutral sentiment on error
      return {
        coinId,
        overall: 'neutral',
        score: 0,
        newsCount24h: 0,
        socialMentions24h: 0,
        lastUpdated: Date.now()
      }
    }
  }

  /**
   * Check if recent news should trigger an alert
   */
  shouldTriggerNewsAlert(articles: NewsArticle[]): { shouldTrigger: boolean; confidence: number; reason: string } {
    const recentArticles = articles.filter(a => {
      const hoursSince = (Date.now() - new Date(a.publishedAt).getTime()) / (1000 * 60 * 60)
      return hoursSince < 2 // Last 2 hours
    })

    if (recentArticles.length === 0) {
      return { shouldTrigger: false, confidence: 0, reason: 'No recent news' }
    }

    // Check for high-impact news
    const highImpact = recentArticles.filter(a =>
      Math.abs(a.sentimentScore) > 60 && a.relevanceScore > 70
    )

    if (highImpact.length > 0) {
      const avgSentiment = highImpact.reduce((sum, a) => sum + a.sentimentScore, 0) / highImpact.length
      return {
        shouldTrigger: true,
        confidence: 85,
        reason: `${highImpact.length} high-impact ${avgSentiment > 0 ? 'positive' : 'negative'} news articles detected`
      }
    }

    // Check for news volume spike
    if (recentArticles.length >= 3) {
      return {
        shouldTrigger: true,
        confidence: 70,
        reason: `Unusual news activity: ${recentArticles.length} articles in 2 hours`
      }
    }

    return { shouldTrigger: false, confidence: 0, reason: 'No significant news catalyst' }
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear()
    this.sentimentCache.clear()
  }
}

export const newsService = new NewsService()
export default newsService
