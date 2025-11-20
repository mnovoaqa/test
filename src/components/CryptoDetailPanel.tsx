import { useEffect, useState, useMemo } from 'react'
import type { CryptoData, EnhancedCryptoData } from '../types/crypto'
import { enhancedCryptoService } from '../services/enhancedCryptoService'
import { alertService } from '../services/alertService'
import ReactApexChart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import './CryptoDetailPanel.css'

interface CryptoDetailPanelProps {
  crypto: CryptoData
}

export default function CryptoDetailPanel({ crypto }: CryptoDetailPanelProps) {
  const [enhancedData, setEnhancedData] = useState<EnhancedCryptoData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadEnhancedData = async () => {
      setLoading(true)
      try {
        const enhanced = await enhancedCryptoService.getEnhancedCryptoData(crypto)
        if (mounted) {
          setEnhancedData(enhanced)
        }
      } catch (error) {
        console.error('Error loading enhanced data:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadEnhancedData()

    return () => {
      mounted = false
    }
  }, [crypto.id])

  if (loading) {
    return (
      <div className="crypto-detail-panel loading">
        <div className="loading-spinner"></div>
        <p>Loading details...</p>
      </div>
    )
  }

  if (!enhancedData) {
    return null
  }

  const sentimentIndicator = enhancedCryptoService.getSentimentIndicator(enhancedData.sentiment)
  const athInfo = enhancedCryptoService.formatATHDistance(crypto.current_price, crypto.ath)
  const predictiveSummary = enhancedCryptoService.getPredictiveSignalSummary(enhancedData.predictiveSignals)

  // Generate price prediction trend
  const predictionData = useMemo(() => {
    const priceHistory = alertService.getPriceHistory(crypto.id)
    if (priceHistory.length < 20) return null

    const recentPrices = priceHistory.slice(-20).map(p => p.price)
    const currentPrice = recentPrices[recentPrices.length - 1]

    // Calculate trend using simple moving average
    const sma = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length
    const trend = currentPrice > sma ? 'up' : 'down'
    const changePercent = ((currentPrice - sma) / sma) * 100

    // Simple prediction: extend trend with decreasing confidence
    const predictions = []
    let predictedPrice = currentPrice
    const trendMultiplier = trend === 'up' ? 1.002 : 0.998

    for (let i = 1; i <= 7; i++) {
      predictedPrice = predictedPrice * trendMultiplier
      const confidence = Math.max(30, 85 - (i * 8)) // Decreasing confidence
      predictions.push({
        day: i,
        price: predictedPrice,
        confidence
      })
    }

    return {
      currentPrice,
      sma,
      trend,
      changePercent,
      predictions
    }
  }, [crypto.id])

  const predictionChartOptions: ApexOptions = useMemo(() => ({
    chart: {
      type: 'line',
      height: 200,
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: false }
    },
    theme: { mode: 'dark' },
    xaxis: {
      categories: predictionData?.predictions.map(p => `Day ${p.day}`) || [],
      labels: { style: { colors: '#6b7280' } }
    },
    yaxis: {
      labels: {
        style: { colors: '#6b7280' },
        formatter: (val: number) => `$${val.toFixed(2)}`
      }
    },
    stroke: {
      curve: 'smooth',
      width: 3,
      dashArray: [0, 5]
    },
    colors: ['#667eea', '#f59e0b'],
    grid: { borderColor: '#374151' },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (val: number) => `$${val.toFixed(2)}`
      }
    },
    legend: {
      show: true,
      labels: { colors: '#9ca3af' }
    }
  }), [predictionData])

  const predictionChartSeries = useMemo(() => {
    if (!predictionData) return []

    return [
      {
        name: 'Current Price',
        data: [predictionData.currentPrice, ...predictionData.predictions.map(() => null)]
      },
      {
        name: 'Predicted',
        data: [predictionData.currentPrice, ...predictionData.predictions.map(p => p.price)]
      }
    ]
  }, [predictionData])

  return (
    <div className="crypto-detail-panel">
      {/* Market Sentiment */}
      <div className="detail-section sentiment-section">
        <h4>Market Sentiment</h4>
        <div className="sentiment-display">
          <span className="sentiment-emoji">{sentimentIndicator.emoji}</span>
          <div className="sentiment-info">
            <span className="sentiment-label" style={{ color: sentimentIndicator.color }}>
              {sentimentIndicator.label}
            </span>
            {enhancedData.sentiment && (
              <span className="sentiment-score">
                Score: {enhancedData.sentiment.score > 0 ? '+' : ''}{enhancedData.sentiment.score}
              </span>
            )}
          </div>
        </div>
        {enhancedData.sentiment && (
          <div className="sentiment-stats">
            <div className="stat-item">
              <span className="stat-label">News (24h):</span>
              <span className="stat-value">{enhancedData.sentiment.newsCount24h}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Social Mentions:</span>
              <span className="stat-value">{enhancedData.sentiment.socialMentions24h}</span>
            </div>
          </div>
        )}
      </div>

      {/* ATH Information */}
      <div className="detail-section ath-section">
        <h4>All-Time High</h4>
        <div className="ath-display">
          <div className="ath-price">
            <span className="label">ATH:</span>
            <span className="value">${crypto.ath.toLocaleString()}</span>
          </div>
          <div className="ath-distance">
            <span className={`distance ${athInfo.distance >= 0 ? 'at-ath' : ''}`}>
              {athInfo.formatted}
            </span>
          </div>
          <div className="ath-date">
            <span className="label">Reached:</span>
            <span className="value">{new Date(crypto.ath_date).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Predictive Signals */}
      {enhancedData.predictiveSignals && enhancedData.predictiveSignals.length > 0 && (
        <div className="detail-section signals-section">
          <h4>Predictive Signals</h4>
          <div className="signals-summary">
            <span className="summary-text">{predictiveSummary}</span>
          </div>
          <div className="signals-list">
            {enhancedData.predictiveSignals.slice(0, 2).map((signal, index) => (
              <div key={index} className="signal-item">
                <div className="signal-type">
                  {signal.type.replace(/_/g, ' ').toUpperCase()}
                </div>
                <div className="signal-description">{signal.description}</div>
                <div className="signal-confidence">
                  Confidence: {signal.confidence}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Price Prediction */}
      {predictionData && (
        <div className="detail-section prediction-section">
          <h4>📊 7-Day Price Prediction</h4>
          <div className="prediction-summary">
            <div className="prediction-stat">
              <span className="stat-label">Current:</span>
              <span className="stat-value">${predictionData.currentPrice.toFixed(2)}</span>
            </div>
            <div className="prediction-stat">
              <span className="stat-label">7-Day Target:</span>
              <span className={`stat-value ${predictionData.trend === 'up' ? 'positive' : 'negative'}`}>
                ${predictionData.predictions[6].price.toFixed(2)}
              </span>
            </div>
            <div className="prediction-stat">
              <span className="stat-label">Trend:</span>
              <span className={`stat-value ${predictionData.trend === 'up' ? 'positive' : 'negative'}`}>
                {predictionData.trend === 'up' ? '📈 Bullish' : '📉 Bearish'}
              </span>
            </div>
          </div>
          <div className="prediction-chart">
            <ReactApexChart
              options={predictionChartOptions}
              series={predictionChartSeries}
              type="line"
              height={200}
            />
          </div>
          <div className="prediction-disclaimer">
            ⚠️ Predictions based on recent price trends. Confidence decreases over time.
          </div>
        </div>
      )}

      {/* Recent News */}
      {enhancedData.recentNews && enhancedData.recentNews.length > 0 && (
        <div className="detail-section news-section">
          <h4>Recent News</h4>
          <div className="news-list">
            {enhancedData.recentNews.map((article, index) => (
              <div key={index} className="news-item-wrapper">
                <div className="news-item-content">
                  <div className="news-header">
                    <span className={`news-sentiment ${article.sentiment}`}>
                      {article.sentiment === 'positive' ? '📈' : article.sentiment === 'negative' ? '📉' : '📊'}
                    </span>
                    <span className="news-source">{article.source}</span>
                  </div>
                  <div className="news-title">{article.title}</div>
                  <div className="news-description">{article.description}</div>
                  <div className="news-meta">
                    <span className="news-time">
                      {new Date(article.publishedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-read-more-btn"
                >
                  Read Full Article →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* White Paper Link */}
      {enhancedData.whitePaperUrl && (
        <div className="detail-section whitepaper-section">
          <h4>Resources</h4>
          <a
            href={enhancedData.whitePaperUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="whitepaper-link"
          >
            📄 View White Paper
          </a>
        </div>
      )}

      {/* Whale Activity */}
      {enhancedData.whaleActivity && (
        <div className="detail-section whale-section">
          <h4>Whale Activity</h4>
          <div className="whale-stats">
            <div className="stat-item">
              <span className="stat-label">Large Transactions (24h):</span>
              <span className="stat-value">{enhancedData.whaleActivity.largeTransactions24h}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Net Flow:</span>
              <span className={`stat-value ${enhancedData.whaleActivity.netFlow >= 0 ? 'positive' : 'negative'}`}>
                {enhancedData.whaleActivity.netFlow >= 0 ? '+' : ''}
                ${(enhancedData.whaleActivity.netFlow / 1000000).toFixed(2)}M
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
