import { useState, useEffect } from 'react'
import type { CryptoData, PredictiveSignal } from '../types/crypto'
import { useCryptoStore } from '../stores/cryptoStore'
import { alertService } from '../services/alertService'
import { predictiveAnalytics } from '../services/predictiveAnalytics'
import CryptoDetailPanel from './CryptoDetailPanel'

interface CryptoCardProps {
  crypto: CryptoData
  onNavigateToChart?: (coinId: string) => void
}

export default function CryptoCard({ crypto, onNavigateToChart }: CryptoCardProps) {
  const { setSelectedCoin, toggleFavorite, settings, addCoinToWatchlist, removeCoinFromWatchlist } = useCryptoStore()
  const isFavorite = settings.favoriteCoins.includes(crypto.id)
  const [showWatchlistMenu, setShowWatchlistMenu] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [predictiveSignals, setPredictiveSignals] = useState<PredictiveSignal[]>([])

  const priceChange = crypto.price_change_percentage_24h
  const isPositive = priceChange >= 0

  // Fetch predictive signals
  useEffect(() => {
    const priceHistory = alertService.getPriceHistory(crypto.id)
    if (priceHistory.length > 50) {
      const signals = predictiveAnalytics.detectPredictiveSignals(priceHistory, crypto.symbol)
      setPredictiveSignals(signals)
    }
  }, [crypto.id, crypto.symbol])

  // Get signal badge info
  const getSignalBadge = (signal: PredictiveSignal) => {
    const isBullish = signal.description.toLowerCase().includes('bullish') ||
                      signal.description.toLowerCase().includes('upward')
    const isBearish = signal.description.toLowerCase().includes('bearish') ||
                      signal.description.toLowerCase().includes('downward')

    let emoji = '📊'
    let color = '#6b7280'
    let label = ''

    switch (signal.type) {
      case 'momentum_shift':
        emoji = isBullish ? '🔥' : '❄️'
        color = isBullish ? '#10b981' : '#ef4444'
        label = 'Momentum'
        break
      case 'breakout':
        emoji = isBullish ? '🚀' : '📉'
        color = isBullish ? '#10b981' : '#ef4444'
        label = 'Breakout'
        break
      case 'trend_reversal':
        emoji = '🔄'
        color = isBullish ? '#10b981' : '#ef4444'
        label = 'Reversal'
        break
      case 'volatility_spike':
        emoji = '⚡'
        color = '#f59e0b'
        label = 'Volatility'
        break
      default:
        emoji = '📈'
        color = '#6b7280'
        label = 'Signal'
    }

    return { emoji, color, label, isBullish, isBearish }
  }

  const formatPrice = (price: number) => {
    if (price < 0.01) {
      return `$${price.toFixed(6)}`
    } else if (price < 1) {
      return `$${price.toFixed(4)}`
    } else {
      return `$${price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }
  }

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) {
      return `$${(volume / 1e9).toFixed(2)}B`
    } else if (volume >= 1e6) {
      return `$${(volume / 1e6).toFixed(2)}M`
    } else if (volume >= 1e3) {
      return `$${(volume / 1e3).toFixed(2)}K`
    }
    return `$${volume.toFixed(2)}`
  }

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) {
      return `$${(marketCap / 1e12).toFixed(2)}T`
    } else if (marketCap >= 1e9) {
      return `$${(marketCap / 1e9).toFixed(2)}B`
    } else if (marketCap >= 1e6) {
      return `$${(marketCap / 1e6).toFixed(2)}M`
    }
    return `$${marketCap.toFixed(2)}`
  }

  const isInWatchlist = (watchlistId: string) => {
    const watchlist = settings.watchlists.find(w => w.id === watchlistId)
    return watchlist?.coinIds.includes(crypto.id) || false
  }

  const handleWatchlistToggle = (watchlistId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isInWatchlist(watchlistId)) {
      removeCoinFromWatchlist(watchlistId, crypto.id)
    } else {
      addCoinToWatchlist(watchlistId, crypto.id)
    }
  }

  const handleCardClick = () => {
    setIsExpanded(!isExpanded)
  }

  const handleViewChart = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onNavigateToChart) {
      onNavigateToChart(crypto.id)
    } else {
      setSelectedCoin(crypto)
    }
  }

  return (
    <div
      className={`crypto-card ${isPositive ? 'positive' : 'negative'}`}
      onClick={handleCardClick}
    >
      <div className="crypto-header">
        <div className="crypto-info">
          <img src={crypto.image} alt={crypto.name} className="crypto-image" />
          <div className="crypto-names">
            <h3 className="crypto-name">{crypto.name}</h3>
            <span className="crypto-symbol">{crypto.symbol.toUpperCase()}</span>
          </div>
        </div>
        <div className="crypto-actions">
          <div className="watchlist-menu-container">
            <button
              className="watchlist-btn"
              onClick={(e) => {
                e.stopPropagation()
                setShowWatchlistMenu(!showWatchlistMenu)
              }}
              title="Add to watchlist"
            >
              📋
            </button>
            {showWatchlistMenu && (
              <div className="watchlist-dropdown" onClick={(e) => e.stopPropagation()}>
                <div className="watchlist-dropdown-header">Add to Watchlist</div>
                {settings.watchlists.length === 0 ? (
                  <div className="watchlist-dropdown-empty">
                    No watchlists yet. Create one first!
                  </div>
                ) : (
                  settings.watchlists.map((watchlist) => (
                    <div
                      key={watchlist.id}
                      className={`watchlist-dropdown-item ${isInWatchlist(watchlist.id) ? 'active' : ''}`}
                      onClick={(e) => handleWatchlistToggle(watchlist.id, e)}
                    >
                      <span>{watchlist.name}</span>
                      {isInWatchlist(watchlist.id) && <span className="checkmark">✓</span>}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            className={`favorite-btn ${isFavorite ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              toggleFavorite(crypto.id)
            }}
            title="Add to favorites"
          >
            {isFavorite ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* Predictive Signals Badges */}
      {predictiveSignals.length > 0 && (
        <div className="predictive-signals-badges">
          {predictiveSignals.slice(0, 2).map((signal, index) => {
            const badge = getSignalBadge(signal)
            return (
              <div
                key={index}
                className="signal-badge"
                style={{ borderColor: badge.color, color: badge.color }}
                title={`${signal.description} (Confidence: ${signal.confidence}%)`}
              >
                <span className="signal-emoji">{badge.emoji}</span>
                <span className="signal-label">{badge.label}</span>
                <span className="signal-confidence">{signal.confidence}%</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="crypto-price">
        <div className="current-price">{formatPrice(crypto.current_price)}</div>
        <div className={`price-change ${isPositive ? 'positive' : 'negative'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)}%
        </div>
      </div>

      <div className="crypto-stats">
        <div className="stat">
          <span className="stat-label">Market Cap</span>
          <span className="stat-value">{formatMarketCap(crypto.market_cap)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Volume 24h</span>
          <span className="stat-value">{formatVolume(crypto.total_volume)}</span>
        </div>
      </div>

      <div className="price-range">
        <div className="range-label">24h Range</div>
        <div className="range-bar">
          <div
            className="range-indicator"
            style={{
              left: `${
                ((crypto.current_price - crypto.low_24h) /
                  (crypto.high_24h - crypto.low_24h)) *
                100
              }%`,
            }}
          />
        </div>
        <div className="range-values">
          <span className="range-low">{formatPrice(crypto.low_24h)}</span>
          <span className="range-high">{formatPrice(crypto.high_24h)}</span>
        </div>
      </div>

      <div className="crypto-rank">#{crypto.market_cap_rank}</div>

      {/* View Chart Button */}
      <button className="view-chart-btn" onClick={handleViewChart}>
        {isExpanded ? '📊 View Live Chart' : '📊 View Chart'}
      </button>

      {/* Expandable Detail Panel */}
      {isExpanded && (
        <div className="crypto-card-expanded">
          <CryptoDetailPanel crypto={crypto} />
        </div>
      )}
    </div>
  )
}
