import { useState, useMemo, useEffect, useRef } from 'react'
import { createChart } from 'lightweight-charts'
import type { UTCTimestamp } from 'lightweight-charts'
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

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const seriesRefs = useRef<Map<string, any>>(new Map())

  const rsiChartContainerRef = useRef<HTMLDivElement>(null)
  const rsiChartRef = useRef<any>(null)
  const rsiSeriesRef = useRef<any>(null)

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

  // Initialize main chart
  useEffect(() => {
    if (!chartContainerRef.current || !hasData) return

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: 'transparent' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    chartRef.current = chart

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesRefs.current.clear()
    }
  }, [hasData])

  // Initialize RSI chart
  useEffect(() => {
    if (!rsiChartContainerRef.current || !hasData || !activeIndicators.has('rsi')) return

    // Create RSI chart
    const rsiChart = createChart(rsiChartContainerRef.current, {
      width: rsiChartContainerRef.current.clientWidth,
      height: 150,
      layout: {
        background: { color: 'transparent' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    rsiChartRef.current = rsiChart

    // Handle resize
    const handleResize = () => {
      if (rsiChartContainerRef.current) {
        rsiChart.applyOptions({ width: rsiChartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      rsiChart.remove()
      rsiChartRef.current = null
      rsiSeriesRef.current = null
    }
  }, [hasData, activeIndicators])

  // Update chart data
  useEffect(() => {
    if (!chartRef.current || !hasData) return

    // Clear existing series
    seriesRefs.current.forEach(series => {
      chartRef.current.removeSeries(series)
    })
    seriesRefs.current.clear()

    // Add volume first (so it's in the background)
    if (activeIndicators.has('volume')) {
      const volumeSeries = chartRef.current.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: 'volume',
      })
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      })
      const volumeData = chartData.map(d => ({
        time: d.time as UTCTimestamp,
        value: d.volume,
        color: d.close >= d.open ? '#26a69a80' : '#ef535080',
      }))
      volumeSeries.setData(volumeData)
      seriesRefs.current.set('volume', volumeSeries)
    }

    // Add main price series (candlestick or line)
    if (chartType === 'candlestick') {
      const candlestickSeries = chartRef.current.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      })
      const candleData = chartData.map(d => ({
        time: d.time as UTCTimestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
      candlestickSeries.setData(candleData)
      seriesRefs.current.set('candlestick', candlestickSeries)
    } else {
      const lineSeries = chartRef.current.addLineSeries({
        color: '#2196F3',
        lineWidth: 2,
      })
      const lineData = chartData.map(d => ({
        time: d.time as UTCTimestamp,
        value: d.close,
      }))
      lineSeries.setData(lineData)
      seriesRefs.current.set('line', lineSeries)
    }

    // Add SMA
    if (activeIndicators.has('sma')) {
      const smaSeries = chartRef.current.addLineSeries({
        color: '#2196F3',
        lineWidth: 2,
        title: 'SMA(20)',
      })
      const smaData = chartData
        .filter(d => d.sma !== undefined)
        .map(d => ({
          time: d.time as UTCTimestamp,
          value: d.sma!,
        }))
      smaSeries.setData(smaData)
      seriesRefs.current.set('sma', smaSeries)
    }

    // Add EMA
    if (activeIndicators.has('ema')) {
      const emaSeries = chartRef.current.addLineSeries({
        color: '#FF6B35',
        lineWidth: 2,
        title: 'EMA(12)',
      })
      const emaData = chartData
        .filter(d => d.ema !== undefined)
        .map(d => ({
          time: d.time as UTCTimestamp,
          value: d.ema!,
        }))
      emaSeries.setData(emaData)
      seriesRefs.current.set('ema', emaSeries)
    }

    // Add Bollinger Bands
    if (activeIndicators.has('bollinger')) {
      const bbUpperSeries = chartRef.current.addLineSeries({
        color: '#9C27B0',
        lineWidth: 1,
        lineStyle: 2, // dashed
        title: 'BB Upper',
      })
      const bbMiddleSeries = chartRef.current.addLineSeries({
        color: '#9C27B0',
        lineWidth: 1,
        title: 'BB Middle',
      })
      const bbLowerSeries = chartRef.current.addLineSeries({
        color: '#9C27B0',
        lineWidth: 1,
        lineStyle: 2, // dashed
        title: 'BB Lower',
      })

      const bbUpperData = chartData
        .filter(d => d.bbUpper !== undefined)
        .map(d => ({
          time: d.time as UTCTimestamp,
          value: d.bbUpper!,
        }))
      const bbMiddleData = chartData
        .filter(d => d.bbMiddle !== undefined)
        .map(d => ({
          time: d.time as UTCTimestamp,
          value: d.bbMiddle!,
        }))
      const bbLowerData = chartData
        .filter(d => d.bbLower !== undefined)
        .map(d => ({
          time: d.time as UTCTimestamp,
          value: d.bbLower!,
        }))

      bbUpperSeries.setData(bbUpperData)
      bbMiddleSeries.setData(bbMiddleData)
      bbLowerSeries.setData(bbLowerData)

      seriesRefs.current.set('bbUpper', bbUpperSeries)
      seriesRefs.current.set('bbMiddle', bbMiddleSeries)
      seriesRefs.current.set('bbLower', bbLowerSeries)
    }

    // Fit content
    chartRef.current.timeScale().fitContent()

  }, [chartData, chartType, activeIndicators, hasData])

  // Update RSI chart data
  useEffect(() => {
    if (!rsiChartRef.current || !hasData || !activeIndicators.has('rsi')) return

    // Clear existing RSI series
    if (rsiSeriesRef.current) {
      rsiChartRef.current.removeSeries(rsiSeriesRef.current)
      rsiSeriesRef.current = null
    }

    // Add RSI line
    const rsiSeries = rsiChartRef.current.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      title: 'RSI(14)',
    })

    const rsiData = chartData
      .filter(d => d.rsi !== undefined)
      .map(d => ({
        time: d.time as UTCTimestamp,
        value: d.rsi!,
      }))

    rsiSeries.setData(rsiData)
    rsiSeriesRef.current = rsiSeries

    // Set price scale options for RSI (0-100 range)
    rsiSeries.priceScale().applyOptions({
      autoScale: false,
    })

    // Fit content
    rsiChartRef.current.timeScale().fitContent()

  }, [chartData, hasData, activeIndicators])

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
              <span className="price-label">PRICE:</span>
              <span className="price-value">${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
            </div>
            <div className={`coin-change ${priceChange24h >= 0 ? 'positive' : 'negative'}`}>
              <span className="change-label">24H:</span>
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
              <div ref={chartContainerRef} className="lightweight-chart" />
            </div>

            {/* RSI Chart */}
            {activeIndicators.has('rsi') && (
              <div className="rsi-container">
                <div className="rsi-label">RSI (14)</div>
                <div ref={rsiChartContainerRef} className="lightweight-chart" />
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
