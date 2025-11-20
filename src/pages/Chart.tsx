import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { useCryptoStore } from '../stores/cryptoStore'
import { alertService } from '../services/alertService'
import { TechnicalIndicatorsCalculator } from '../services/technicalIndicators'
import './Chart.css'

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '7d' | '30d' | '90d' | '1y'
type ChartType = 'candlestick' | 'line'
type IndicatorType = 'sma' | 'ema' | 'rsi' | 'bollinger' | 'volume'

interface CandleData {
  time: number
  timeStr: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  sma?: number
  ema?: number
  bbUpper?: number
  bbMiddle?: number
  bbLower?: number
  rsi?: number
}

interface ChartProps {
  initialCoinId?: string | null
}

export default function Chart({ initialCoinId }: ChartProps) {
  const { cryptoList } = useCryptoStore()
  const [selectedCoin, setSelectedCoin] = useState<string>(initialCoinId || 'bitcoin')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [timeframe, setTimeframe] = useState<Timeframe>('1d')
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorType>>(new Set(['volume']))

  const [indicatorStatus, setIndicatorStatus] = useState<string>('')

  const toggleIndicator = (indicator: IndicatorType) => {
    setActiveIndicators(prev => {
      const newSet = new Set(prev)

      if (newSet.has(indicator)) {
        newSet.delete(indicator)
        setIndicatorStatus(`${indicator.toUpperCase()} removed from chart`)
      } else {
        newSet.add(indicator)
        setIndicatorStatus(`${indicator.toUpperCase()} added to chart`)
      }

      // Clear status after 2 seconds
      setTimeout(() => setIndicatorStatus(''), 2000)

      return newSet
    })
  }

  const currentCoin = cryptoList.find(c => c.id === selectedCoin)
  const priceHistory = alertService.getPriceHistory(selectedCoin)
  const currentPrice = currentCoin?.current_price || 0
  const priceChange24h = currentCoin?.price_change_percentage_24h || 0

  // Filter crypto list based on search query
  const filteredCryptoList = useMemo(() => {
    if (!searchQuery.trim()) return cryptoList.slice(0, 50)

    const query = searchQuery.toLowerCase()
    return cryptoList.filter(coin =>
      coin.name.toLowerCase().includes(query) ||
      coin.symbol.toLowerCase().includes(query) ||
      coin.id.toLowerCase().includes(query)
    ).slice(0, 20)
  }, [cryptoList, searchQuery])

  // Calculate chart data with indicators
  const chartData = useMemo(() => {
    if (priceHistory.length === 0) return []

    // Convert to candlestick data
    const candleData = aggregateToCandlesticks(priceHistory, timeframe)

    if (candleData.length === 0) return []

    // Calculate indicators if enabled
    const prices = candleData.map(c => c.close)

    // Add SMA
    if (activeIndicators.has('sma')) {
      const smaValues = TechnicalIndicatorsCalculator.calculateSMASeries(prices, 20)
      smaValues.forEach((value, index) => {
        if (candleData[index]) {
          candleData[index].sma = value
        }
      })
    }

    // Add EMA
    if (activeIndicators.has('ema')) {
      const emaValues = TechnicalIndicatorsCalculator.calculateEMASeries(prices, 12)
      const offset = prices.length - emaValues.length
      emaValues.forEach((value, index) => {
        if (candleData[index + offset]) {
          candleData[index + offset].ema = value
        }
      })
    }

    // Add Bollinger Bands
    if (activeIndicators.has('bollinger')) {
      const bollinger = TechnicalIndicatorsCalculator.calculateBollingerBandsSeries(prices, 20, 2)
      bollinger.upper.forEach((value, index) => {
        if (candleData[index]) {
          candleData[index].bbUpper = value
          candleData[index].bbMiddle = bollinger.middle[index]
          candleData[index].bbLower = bollinger.lower[index]
        }
      })
    }

    // Add RSI
    if (activeIndicators.has('rsi')) {
      for (let i = 14; i < prices.length; i++) {
        const rsi = TechnicalIndicatorsCalculator.calculateRSI(prices.slice(0, i + 1), 14)
        if (candleData[i]) {
          candleData[i].rsi = rsi
        }
      }
    }

    return candleData
  }, [priceHistory, timeframe, activeIndicators, selectedCoin])

  const hasData = chartData.length > 0

  // Custom candlestick component
  const Candlestick = (props: any) => {
    const { x, y, width, height, payload } = props
    const isGreen = payload.close >= payload.open

    if (!payload || !x || !width) return null

    const bodyHeight = Math.abs(payload.close - payload.open)
    const bodyY = Math.min(payload.close, payload.open)
    const wickHeight = payload.high - payload.low

    return (
      <g>
        {/* Wick */}
        <line
          x1={x + width / 2}
          y1={y}
          x2={x + width / 2}
          y2={y + height}
          stroke={isGreen ? '#26a69a' : '#ef5350'}
          strokeWidth={1}
        />
        {/* Body */}
        <rect
          x={x}
          y={y + ((payload.high - bodyY) / wickHeight) * height}
          width={width}
          height={Math.max(1, (bodyHeight / wickHeight) * height)}
          fill={isGreen ? '#26a69a' : '#ef5350'}
          stroke={isGreen ? '#26a69a' : '#ef5350'}
        />
      </g>
    )
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as CandleData
      return (
        <div className="chart-tooltip">
          <p className="tooltip-time">{data.timeStr}</p>
          <p className="tooltip-item">O: <span>${data.open.toFixed(8)}</span></p>
          <p className="tooltip-item">H: <span>${data.high.toFixed(8)}</span></p>
          <p className="tooltip-item">L: <span>${data.low.toFixed(8)}</span></p>
          <p className="tooltip-item">C: <span>${data.close.toFixed(8)}</span></p>
          {activeIndicators.has('volume') && (
            <p className="tooltip-item">Vol: <span>{data.volume.toFixed(2)}</span></p>
          )}
          {activeIndicators.has('sma') && data.sma && (
            <p className="tooltip-item" style={{ color: '#2196F3' }}>SMA(20): <span>${data.sma.toFixed(8)}</span></p>
          )}
          {activeIndicators.has('ema') && data.ema && (
            <p className="tooltip-item" style={{ color: '#FF6B35' }}>EMA(12): <span>${data.ema.toFixed(8)}</span></p>
          )}
          {activeIndicators.has('rsi') && data.rsi && (
            <p className="tooltip-item" style={{ color: '#2962FF' }}>RSI: <span>{data.rsi.toFixed(2)}</span></p>
          )}
        </div>
      )
    }
    return null
  }

  // Format price for Y-axis
  const formatPrice = (value: number) => {
    if (value < 0.01) return value.toFixed(8)
    if (value < 1) return value.toFixed(6)
    if (value < 100) return value.toFixed(4)
    return value.toFixed(2)
  }

  // Format time for X-axis
  const formatTime = (value: number) => {
    const date = new Date(value * 1000)
    if (timeframe === '1m' || timeframe === '5m' || timeframe === '15m' || timeframe === '1h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (timeframe === '4h' || timeframe === '1d' || timeframe === '7d') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    } else {
      // For 30d, 90d, 1y show month and year
      return date.toLocaleDateString([], { month: 'short', year: '2-digit' })
    }
  }

  return (
    <div className="chart-page">
      <div className="chart-header">
        <div className="chart-title-section">
          <h2>Live Chart</h2>
          <div className="coin-search-container">
            <input
              type="text"
              placeholder="Search cryptocurrency..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="coin-search-input"
            />
            <select
              value={selectedCoin}
              onChange={(e) => setSelectedCoin(e.target.value)}
              className="coin-select"
            >
              {filteredCryptoList.map(coin => (
                <option key={coin.id} value={coin.id}>
                  {coin.symbol.toUpperCase()} - {coin.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {currentCoin && (
          <div className="coin-info">
            <div className="coin-price">
              <span className="price-label">Price:</span>
              <span className="price-value">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
            </div>
            <div className={`coin-change ${priceChange24h >= 0 ? 'positive' : 'negative'}`}>
              <span className="change-label">24h:</span>
              <span className="change-value">{priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%</span>
            </div>
            <div className="data-points">
              <span>{priceHistory.length} data points</span>
            </div>
          </div>
        )}
      </div>

      <div className="chart-controls">
        <div className="chart-type-selector">
          <span className="control-label">Chart Type:</span>
          <button
            className={`chart-type-btn ${chartType === 'candlestick' ? 'active' : ''}`}
            onClick={() => setChartType('candlestick')}
          >
            Candlestick
          </button>
          <button
            className={`chart-type-btn ${chartType === 'line' ? 'active' : ''}`}
            onClick={() => setChartType('line')}
          >
            Line
          </button>
        </div>

        <div className="timeframe-selector">
          <span className="control-label">Timeframe:</span>
          {(['1m', '5m', '15m', '1h', '4h', '1d', '7d', '30d', '90d', '1y'] as Timeframe[]).map(tf => (
            <button
              key={tf}
              className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="indicator-selector">
          <span className="control-label">Indicators:</span>
          <button
            className={`indicator-btn ${activeIndicators.has('volume') ? 'active' : ''}`}
            onClick={() => toggleIndicator('volume')}
          >
            {activeIndicators.has('volume') ? '✓ ' : ''}Volume
          </button>
          <button
            className={`indicator-btn ${activeIndicators.has('sma') ? 'active' : ''}`}
            onClick={() => toggleIndicator('sma')}
          >
            {activeIndicators.has('sma') ? '✓ ' : ''}SMA(20)
          </button>
          <button
            className={`indicator-btn ${activeIndicators.has('ema') ? 'active' : ''}`}
            onClick={() => toggleIndicator('ema')}
          >
            {activeIndicators.has('ema') ? '✓ ' : ''}EMA(12)
          </button>
          <button
            className={`indicator-btn ${activeIndicators.has('bollinger') ? 'active' : ''}`}
            onClick={() => toggleIndicator('bollinger')}
          >
            {activeIndicators.has('bollinger') ? '✓ ' : ''}Bollinger Bands
          </button>
          <button
            className={`indicator-btn ${activeIndicators.has('rsi') ? 'active' : ''}`}
            onClick={() => toggleIndicator('rsi')}
          >
            {activeIndicators.has('rsi') ? '✓ ' : ''}RSI
          </button>
        </div>
      </div>

      {indicatorStatus && (
        <div className="indicator-status-banner">
          {indicatorStatus}
        </div>
      )}

      <div className="chart-wrapper">
        {!hasData ? (
          <div className="chart-empty-state">
            <div className="empty-state-content">
              <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3>Collecting Price Data...</h3>
              <p>The chart will appear once enough data points are collected.</p>
              <p className="data-status">Current data points: <strong>{priceHistory.length}</strong></p>
              <p className="wait-message">Price updates occur every 10 seconds. Please wait a moment.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={500}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    dataKey="time"
                    tickFormatter={formatTime}
                    stroke="var(--text-secondary)"
                    tick={{ fill: 'var(--text-secondary)' }}
                  />
                  <YAxis
                    yAxisId="price"
                    orientation="right"
                    tickFormatter={formatPrice}
                    stroke="var(--text-secondary)"
                    tick={{ fill: 'var(--text-secondary)' }}
                    domain={['auto', 'auto']}
                  />
                  {activeIndicators.has('volume') && (
                    <YAxis
                      yAxisId="volume"
                      orientation="left"
                      stroke="var(--text-secondary)"
                      tick={{ fill: 'var(--text-secondary)' }}
                      domain={[0, 'auto']}
                    />
                  )}
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />

                  {/* Volume bars */}
                  {activeIndicators.has('volume') && (
                    <Bar
                      yAxisId="volume"
                      dataKey="volume"
                      fill="#26a69a"
                      opacity={0.3}
                      name="Volume"
                    />
                  )}

                  {/* Candlesticks or Line Chart */}
                  {chartType === 'candlestick' ? (
                    <Bar
                      yAxisId="price"
                      dataKey="high"
                      shape={<Candlestick />}
                      name="Price"
                    />
                  ) : (
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="close"
                      stroke="#2196F3"
                      strokeWidth={2}
                      dot={false}
                      name="Price"
                    />
                  )}

                  {/* Bollinger Bands */}
                  {activeIndicators.has('bollinger') && (
                    <>
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="bbUpper"
                        stroke="#9C27B0"
                        strokeWidth={1}
                        strokeDasharray="5 5"
                        dot={false}
                        name="BB Upper"
                      />
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="bbMiddle"
                        stroke="#9C27B0"
                        strokeWidth={1}
                        dot={false}
                        name="BB Middle"
                      />
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="bbLower"
                        stroke="#9C27B0"
                        strokeWidth={1}
                        strokeDasharray="5 5"
                        dot={false}
                        name="BB Lower"
                      />
                    </>
                  )}

                  {/* SMA */}
                  {activeIndicators.has('sma') && (
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="sma"
                      stroke="#2196F3"
                      strokeWidth={2}
                      dot={false}
                      name="SMA(20)"
                    />
                  )}

                  {/* EMA */}
                  {activeIndicators.has('ema') && (
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="ema"
                      stroke="#FF6B35"
                      strokeWidth={2}
                      dot={false}
                      name="EMA(12)"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* RSI Chart */}
            {activeIndicators.has('rsi') && (
              <div className="rsi-container">
                <div className="rsi-label">RSI (14)</div>
                <ResponsiveContainer width="100%" height={150}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis
                      dataKey="time"
                      tickFormatter={formatTime}
                      stroke="var(--text-secondary)"
                      tick={{ fill: 'var(--text-secondary)' }}
                    />
                    <YAxis
                      stroke="var(--text-secondary)"
                      tick={{ fill: 'var(--text-secondary)' }}
                      domain={[0, 100]}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={70} stroke="#ef5350" strokeDasharray="3 3" label="Overbought" />
                    <ReferenceLine y={30} stroke="#26a69a" strokeDasharray="3 3" label="Oversold" />
                    <Line
                      type="monotone"
                      dataKey="rsi"
                      stroke="#2962FF"
                      strokeWidth={2}
                      dot={false}
                      name="RSI"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>

      <div className="chart-info">
        <p className="info-text">
          <strong>Tip:</strong> Use the timeframe selector to adjust the candlestick interval.
          Click indicator buttons to toggle them ON/OFF - watch for the ✓ checkmark and status banner.
          {!hasData && ' The chart needs at least 10 data points to display.'}
          {hasData && ` Currently showing ${chartData.length} candles with ${activeIndicators.size} active indicator(s).`}
        </p>
      </div>
    </div>
  )
}

/**
 * Aggregate price history into candlesticks based on timeframe
 */
function aggregateToCandlesticks(
  priceHistory: Array<{ price: number; volume: number; timestamp: number }>,
  timeframe: Timeframe
): CandleData[] {
  if (priceHistory.length === 0) return []

  // Determine candle duration in milliseconds
  const candleDuration = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
  }[timeframe]

  const candles: { [key: number]: { open: number; high: number; low: number; close: number; volume: number; prices: number[] } } = {}

  // Group prices by candle
  priceHistory.forEach(point => {
    const candleTime = Math.floor(point.timestamp / candleDuration) * candleDuration

    if (!candles[candleTime]) {
      candles[candleTime] = {
        open: point.price,
        high: point.price,
        low: point.price,
        close: point.price,
        volume: point.volume,
        prices: [point.price],
      }
    } else {
      candles[candleTime].high = Math.max(candles[candleTime].high, point.price)
      candles[candleTime].low = Math.min(candles[candleTime].low, point.price)
      candles[candleTime].close = point.price
      candles[candleTime].volume = Math.max(candles[candleTime].volume, point.volume)
      candles[candleTime].prices.push(point.price)
    }
  })

  // Convert to array and sort by time
  return Object.entries(candles)
    .map(([time, candle]) => {
      const timestamp = Number(time) / 1000 // Convert to seconds
      const date = new Date(Number(time))
      return {
        time: timestamp,
        timeStr: date.toLocaleString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      }
    })
    .sort((a, b) => a.time - b.time)
}
