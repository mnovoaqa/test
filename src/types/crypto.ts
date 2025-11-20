export interface CryptoData {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  market_cap: number
  market_cap_rank: number
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_24h: number
  price_change_percentage_24h: number
  price_change_percentage_1h_in_currency?: number
  price_change_percentage_7d_in_currency?: number
  circulating_supply: number
  total_supply: number
  max_supply: number
  ath: number
  ath_date: string
  atl: number
  atl_date: string
  last_updated: string
}

export interface CryptoPrice {
  symbol: string
  price: number
  timestamp: number
  volume: number
}

export interface TechnicalIndicators {
  rsi: number
  macd: {
    macd: number
    signal: number
    histogram: number
  }
  bollingerBands: {
    upper: number
    middle: number
    lower: number
  }
}

export interface Alert {
  id: string
  coinId: string
  coinSymbol: string
  coinName: string
  type: 'price_spike' | 'volume_spike' | 'rsi_oversold' | 'rsi_overbought' | 'trend_reversal' | 'breakout' | 'news_catalyst' | 'whale_activity'
  message: string
  price: number
  priceChange: number
  priceChangePercent: number
  volume: number
  volumeChange?: number
  rsi?: number
  timestamp: number
  triggered: boolean
  confidence?: number
  predictiveScore?: number
  newsRelated?: boolean
}

export interface NewsArticle {
  id: string
  coinId: string
  coinSymbol: string
  title: string
  description: string
  url: string
  source: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral'
  sentimentScore: number
  relevanceScore: number
}

export interface MarketSentiment {
  coinId: string
  overall: 'bullish' | 'bearish' | 'neutral'
  score: number // -100 to 100
  newsCount24h: number
  socialMentions24h: number
  lastUpdated: number
}

export interface PredictiveSignal {
  type: 'trend_reversal' | 'breakout' | 'momentum_shift' | 'volatility_spike'
  strength: number // 0-100
  confidence: number // 0-100
  timeframe: string
  description: string
  timestamp: number
}

export interface EnhancedCryptoData extends CryptoData {
  sentiment?: MarketSentiment
  recentNews?: NewsArticle[]
  whitePaperUrl?: string
  predictiveSignals?: PredictiveSignal[]
  whaleActivity?: {
    largeTransactions24h: number
    netFlow: number
  }
}

export interface AlertConfig {
  priceChangeThreshold: number // percentage
  priceChangeWindow: number // minutes
  volumeSpike: number // percentage above average
  rsiOversold: number
  rsiOverbought: number
  enableSound: boolean
  enablePush: boolean
  enableWebhook: boolean
  webhookUrl?: string
}

export interface Watchlist {
  id: string
  name: string
  coinIds: string[]
  createdAt: number
  updatedAt: number
}

export interface UserSettings {
  theme: 'light' | 'dark'
  defaultAlertConfig: AlertConfig
  watchlists: Watchlist[]
  favoriteCoins: string[]
  timezone: string
  updateFrequency: number // ms
}

export interface PriceHistory {
  timestamp: number
  price: number
  volume: number
}

export interface TradeCalculation {
  entryPrice: number
  exitPrice: number
  quantity: number
  profit: number
  profitPercent: number
  fees?: number
}
