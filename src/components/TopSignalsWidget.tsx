import { useEffect, useState } from 'react'
import type { CryptoData, PredictiveSignal } from '../types/crypto'
import { useCryptoStore } from '../stores/cryptoStore'
import { alertService } from '../services/alertService'
import { predictiveAnalytics } from '../services/predictiveAnalytics'
import './TopSignalsWidget.css'

interface SignalRanking {
  crypto: CryptoData
  signals: PredictiveSignal[]
  overallConfidence: number
  trend: 'bullish' | 'bearish' | 'neutral'
  topSignal: PredictiveSignal | null
}

interface TopSignalsWidgetProps {
  onNavigateToChart?: (coinId: string) => void
}

export default function TopSignalsWidget({ onNavigateToChart }: TopSignalsWidgetProps) {
  const { cryptoList } = useCryptoStore()
  const [topSignals, setTopSignals] = useState<SignalRanking[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const calculateTopSignals = () => {
      setIsLoading(true)

      const rankings: SignalRanking[] = []

      // Analyze each crypto for signals
      cryptoList.forEach(crypto => {
        const priceHistory = alertService.getPriceHistory(crypto.id)

        // Need sufficient data for analysis
        if (priceHistory.length < 50) return

        // Detect signals
        const signals = predictiveAnalytics.detectPredictiveSignals(priceHistory, crypto.symbol)

        if (signals.length === 0) return

        // Calculate overall confidence
        const overallConfidence = predictiveAnalytics.calculateOverallConfidence(signals)

        // Determine trend
        const trend = predictiveAnalytics.getPredictiveTrend(signals)

        // Get top signal
        const topSignal = signals.reduce((best, signal) =>
          signal.confidence > best.confidence ? signal : best
        , signals[0])

        rankings.push({
          crypto,
          signals,
          overallConfidence,
          trend,
          topSignal
        })
      })

      // Sort by overall confidence (descending)
      rankings.sort((a, b) => b.overallConfidence - a.overallConfidence)

      // Take top 5
      setTopSignals(rankings.slice(0, 5))
      setIsLoading(false)
    }

    calculateTopSignals()

    // Refresh every 30 seconds
    const interval = setInterval(calculateTopSignals, 30000)

    return () => clearInterval(interval)
  }, [cryptoList])

  const getTrendIcon = (trend: 'bullish' | 'bearish' | 'neutral') => {
    switch (trend) {
      case 'bullish':
        return '📈'
      case 'bearish':
        return '📉'
      default:
        return '➡️'
    }
  }

  const getTrendColor = (trend: 'bullish' | 'bearish' | 'neutral') => {
    switch (trend) {
      case 'bullish':
        return '#10b981'
      case 'bearish':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case 'momentum_shift':
        return '🔥'
      case 'breakout':
        return '🚀'
      case 'trend_reversal':
        return '🔄'
      case 'volatility_spike':
        return '⚡'
      default:
        return '📊'
    }
  }

  if (isLoading || topSignals.length === 0) {
    return (
      <div className="top-signals-widget loading">
        <div className="widget-header">
          <h3>🎯 Top AI Signals</h3>
          <span className="widget-badge">Live</span>
        </div>
        <div className="widget-loading">
          {isLoading ? (
            <>
              <div className="loading-spinner"></div>
              <p>Analyzing market signals...</p>
            </>
          ) : (
            <p className="no-signals">
              No signals detected yet. Waiting for sufficient price data...
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="top-signals-widget">
      <div className="widget-header">
        <div className="header-content">
          <h3>🎯 Top AI Signals</h3>
          <span className="widget-badge">Live</span>
        </div>
        <p className="widget-subtitle">
          Strongest predictive signals across all tracked cryptocurrencies
        </p>
      </div>

      <div className="signals-grid">
        {topSignals.map((ranking, index) => (
          <div
            key={ranking.crypto.id}
            className="signal-card"
            onClick={() => onNavigateToChart && onNavigateToChart(ranking.crypto.id)}
            style={{ borderColor: getTrendColor(ranking.trend) }}
          >
            <div className="signal-rank">#{index + 1}</div>

            <div className="signal-crypto-info">
              <img
                src={ranking.crypto.image}
                alt={ranking.crypto.name}
                className="signal-crypto-image"
              />
              <div className="signal-crypto-details">
                <h4 className="signal-crypto-name">{ranking.crypto.name}</h4>
                <span className="signal-crypto-symbol">
                  {ranking.crypto.symbol.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="signal-info">
              <div className="signal-trend" style={{ color: getTrendColor(ranking.trend) }}>
                <span className="trend-icon">{getTrendIcon(ranking.trend)}</span>
                <span className="trend-label">{ranking.trend.toUpperCase()}</span>
              </div>

              <div className="signal-confidence">
                <div className="confidence-bar">
                  <div
                    className="confidence-fill"
                    style={{
                      width: `${ranking.overallConfidence}%`,
                      backgroundColor: getTrendColor(ranking.trend)
                    }}
                  />
                </div>
                <span className="confidence-value">{Math.round(ranking.overallConfidence)}% confidence</span>
              </div>

              {ranking.topSignal && (
                <div className="signal-top">
                  <span className="signal-icon">{getSignalIcon(ranking.topSignal.type)}</span>
                  <span className="signal-description">{ranking.topSignal.description}</span>
                </div>
              )}

              <div className="signal-meta">
                <span className="signal-count">{ranking.signals.length} signal{ranking.signals.length > 1 ? 's' : ''}</span>
                <span className="signal-timeframe">{ranking.topSignal?.timeframe || 'medium-term'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="widget-footer">
        <p className="widget-disclaimer">
          ⚠️ AI predictions are probabilistic and should not be considered financial advice.
          Always conduct your own research before making investment decisions.
        </p>
      </div>
    </div>
  )
}
