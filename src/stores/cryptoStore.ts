import { create } from 'zustand'
import type {
  CryptoData,
  Alert,
  AlertConfig,
  UserSettings,
  Watchlist,
  TechnicalIndicators,
} from '../types/crypto'
import { coinGeckoService } from '../services/coinGeckoService'
import { cryptoPricePoller } from '../services/cryptoPricePoller'
import { alertService } from '../services/alertService'
import { notificationService } from '../services/notificationService'
import { TechnicalIndicatorsCalculator } from '../services/technicalIndicators'

interface CryptoStore {
  // Data
  cryptoList: CryptoData[]
  loading: boolean
  error: string | null
  alerts: Alert[]
  indicators: Map<string, TechnicalIndicators>

  // User settings
  settings: UserSettings
  sortBy: 'market_cap' | 'price' | 'change_24h' | 'change_1h' | 'volume'
  sortOrder: 'asc' | 'desc'
  filterText: string
  selectedCoin: CryptoData | null

  // Actions
  fetchCryptoData: () => Promise<void>
  updateCryptoPrice: (coinId: string, price: number, volume: number) => void
  setSelectedCoin: (coin: CryptoData | null) => void
  setSortBy: (sortBy: CryptoStore['sortBy']) => void
  toggleSortOrder: () => void
  setFilterText: (text: string) => void
  updateSettings: (settings: Partial<UserSettings>) => void
  addToWatchlist: (watchlist: Watchlist) => void
  removeFromWatchlist: (watchlistId: string) => void
  toggleFavorite: (coinId: string) => void
  clearAlerts: () => void
  calculateIndicators: (coinId: string) => void
}

const defaultAlertConfig: AlertConfig = {
  priceChangeThreshold: 3,
  priceChangeWindow: 5,
  volumeSpike: 200,
  rsiOversold: 30,
  rsiOverbought: 70,
  enableSound: true,
  enablePush: true,
  enableWebhook: false,
}

const defaultSettings: UserSettings = {
  theme: 'dark',
  defaultAlertConfig,
  watchlists: [],
  favoriteCoins: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  updateFrequency: 1000,
}

export const useCryptoStore = create<CryptoStore>((set, get) => ({
  // Initial state
  cryptoList: [],
  loading: false,
  error: null,
  alerts: [],
  indicators: new Map(),
  settings: defaultSettings,
  sortBy: 'market_cap',
  sortOrder: 'desc',
  filterText: '',
  selectedCoin: null,

  // Fetch cryptocurrency data
  fetchCryptoData: async () => {
    set({ loading: true, error: null })

    try {
      const data = await coinGeckoService.getTop100Cryptocurrencies()

      // Subscribe to price polling updates for all coins
      data.forEach((coin) => {
        cryptoPricePoller.subscribe(coin.symbol, coin.id, (priceData) => {
          get().updateCryptoPrice(coin.id, priceData.price, priceData.volume)
        })

        // Add initial price data to alert service
        alertService.addPriceData(
          coin.id,
          coin.current_price,
          coin.total_volume,
          Date.now()
        )
      })

      // Subscribe to alerts
      alertService.onAlert((alert) => {
        set({ alerts: alertService.getAlertHistory() })
        notificationService.handleAlert(alert, get().settings.defaultAlertConfig)
      })

      set({ cryptoList: data, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch crypto data',
        loading: false,
      })
    }
  },

  // Update cryptocurrency price from polling service
  updateCryptoPrice: (coinId: string, price: number, volume: number) => {
    set((state) => {
      const cryptoList = state.cryptoList.map((coin) => {
        if (coin.id === coinId) {
          const priceChange24h = price - coin.current_price
          const priceChangePercentage24h =
            ((price - coin.current_price) / coin.current_price) * 100

          const updatedCoin = {
            ...coin,
            current_price: price,
            total_volume: volume,
            price_change_24h: priceChange24h,
            price_change_percentage_24h: priceChangePercentage24h,
            last_updated: new Date().toISOString(),
          }

          // Add to alert service for monitoring
          alertService.addPriceData(coinId, price, volume, Date.now())

          // Check for alerts
          alertService.checkForAlerts(updatedCoin, state.settings.defaultAlertConfig)

          return updatedCoin
        }
        return coin
      })

      return { cryptoList }
    })
  },

  // Set selected coin
  setSelectedCoin: (coin) => {
    set({ selectedCoin: coin })

    if (coin) {
      get().calculateIndicators(coin.id)
    }
  },

  // Set sort by
  setSortBy: (sortBy) => {
    set({ sortBy })
  },

  // Toggle sort order
  toggleSortOrder: () => {
    set((state) => ({
      sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc',
    }))
  },

  // Set filter text
  setFilterText: (text) => {
    set({ filterText: text })
  },

  // Update settings
  updateSettings: (newSettings) => {
    set((state) => ({
      settings: {
        ...state.settings,
        ...newSettings,
      },
    }))

    // Save to localStorage
    const settings = get().settings
    localStorage.setItem('cryptoSettings', JSON.stringify(settings))
  },

  // Add to watchlist
  addToWatchlist: (watchlist) => {
    set((state) => ({
      settings: {
        ...state.settings,
        watchlists: [...state.settings.watchlists, watchlist],
      },
    }))

    // Save to localStorage
    const settings = get().settings
    localStorage.setItem('cryptoSettings', JSON.stringify(settings))
  },

  // Remove from watchlist
  removeFromWatchlist: (watchlistId) => {
    set((state) => ({
      settings: {
        ...state.settings,
        watchlists: state.settings.watchlists.filter((w) => w.id !== watchlistId),
      },
    }))

    // Save to localStorage
    const settings = get().settings
    localStorage.setItem('cryptoSettings', JSON.stringify(settings))
  },

  // Toggle favorite
  toggleFavorite: (coinId) => {
    set((state) => {
      const favoriteCoins = state.settings.favoriteCoins.includes(coinId)
        ? state.settings.favoriteCoins.filter((id) => id !== coinId)
        : [...state.settings.favoriteCoins, coinId]

      return {
        settings: {
          ...state.settings,
          favoriteCoins,
        },
      }
    })

    // Save to localStorage
    const settings = get().settings
    localStorage.setItem('cryptoSettings', JSON.stringify(settings))
  },

  // Clear alerts
  clearAlerts: () => {
    alertService.clearAlertHistory()
    set({ alerts: [] })
  },

  // Calculate technical indicators
  calculateIndicators: (coinId: string) => {
    const priceHistory = alertService.getPriceHistory(coinId)

    if (priceHistory.length >= 14) {
      const indicators = TechnicalIndicatorsCalculator.calculateAllIndicators(priceHistory)

      set((state) => {
        const newIndicators = new Map(state.indicators)
        newIndicators.set(coinId, indicators)
        return { indicators: newIndicators }
      })
    }
  },
}))

// Load settings from localStorage on initialization
const savedSettings = localStorage.getItem('cryptoSettings')
if (savedSettings) {
  try {
    const settings = JSON.parse(savedSettings)
    useCryptoStore.setState({ settings })
  } catch (error) {
    console.error('Error loading saved settings:', error)
  }
}
