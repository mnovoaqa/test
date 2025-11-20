import { useEffect, useRef, useState } from 'react'
import { createChart, LineStyle, CrosshairMode } from 'lightweight-charts'
import type { Time } from 'lightweight-charts'
import { useCryptoStore } from '../stores/cryptoStore'
import { alertService } from '../services/alertService'
import { TechnicalIndicatorsCalculator } from '../services/technicalIndicators'
import './Chart.css'

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'
type IndicatorType = 'sma' | 'ema' | 'rsi' | 'bollinger' | 'volume'

export default function Chart() {
  const { cryptoList } = useCryptoStore()
  const [selectedCoin, setSelectedCoin] = useState<string>('bitcoin')
  const [timeframe, setTimeframe] = useState<Timeframe>('15m')
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorType>>(new Set(['volume']))
  const [chartReady, setChartReady] = useState(false)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null) // Using any for lightweight-charts v5 API compatibility
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  const rsiChartRef = useRef<any>(null) // Using any for lightweight-charts v5 API compatibility
  const seriesRefs = useRef<any[]>([])
  const rsiSeriesRefs = useRef<any[]>([])

  // Initialize main chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b2b2b' },
        horzLines: { color: '#2b2b2b' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#2b2b2b',
      },
      timeScale: {
        borderColor: '#2b2b2b',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    chartRef.current = chart
    setChartReady(true)
    console.log('Main chart initialized successfully')

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      setChartReady(false)
      chart.remove()
      chartRef.current = null
    }
  }, [])

  // Initialize RSI chart
  useEffect(() => {
    if (!rsiContainerRef.current || !activeIndicators.has('rsi')) {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
      }
      return
    }

    const rsiChart = createChart(rsiContainerRef.current, {
      width: rsiContainerRef.current.clientWidth,
      height: 150,
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b2b2b' },
        horzLines: { color: '#2b2b2b' },
      },
      rightPriceScale: {
        borderColor: '#2b2b2b',
      },
      timeScale: {
        borderColor: '#2b2b2b',
        visible: false,
      },
    })

    rsiChartRef.current = rsiChart

    // Handle resize
    const handleResize = () => {
      if (rsiContainerRef.current && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({
          width: rsiContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
      }
    }
  }, [activeIndicators])

  // Update chart data
  useEffect(() => {
    if (!chartReady || !chartRef.current) {
      console.log('Chart not ready yet. chartReady:', chartReady, 'chartRef.current:', !!chartRef.current)
      return
    }

    const coin = cryptoList.find(c => c.id === selectedCoin)
    if (!coin) {
      console.log('Coin not found:', selectedCoin)
      return
    }

    // Get price history
    const priceHistory = alertService.getPriceHistory(selectedCoin)

    if (priceHistory.length === 0) {
      console.log('No price history available yet - waiting for data collection')
      return
    }

    // Convert to candlestick data
    const candleData = aggregateToCandlesticks(priceHistory, timeframe)

    if (candleData.length === 0) {
      console.log('No candle data after aggregation - need more data points')
      return
    }

    console.log('Updating chart with', candleData.length, 'candles')

    try {
      // Clear all series
      seriesRefs.current.forEach(series => {
        if (chartRef.current) {
          chartRef.current.removeSeries(series)
        }
      })
      seriesRefs.current = []

      // Add candlestick series
      const candlestickSeries = chartRef.current.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      })

      // Set candlestick data
      const mappedCandles = candleData.map(c => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))

      candlestickSeries.setData(mappedCandles)
      seriesRefs.current.push(candlestickSeries)
      console.log('Candlestick series created and data set successfully')
    } catch (error) {
      console.error('Error creating/setting candlestick series:', error)
      return
    }

    // Add volume if enabled
    if (activeIndicators.has('volume') && chartRef.current) {
      try {
        const volumeSeries = chartRef.current.addHistogramSeries({
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume',
        })

        chartRef.current.priceScale('volume').applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        })

        const volumeData = candleData.map(c => ({
          time: c.time as Time,
          value: c.volume,
          color: c.close >= c.open ? '#26a69a80' : '#ef535080',
        }))

        volumeSeries.setData(volumeData)
        seriesRefs.current.push(volumeSeries)
        console.log('Volume series added successfully')
      } catch (error) {
        console.error('Error adding volume series:', error)
      }
    }

    // Calculate and display SMA if enabled
    if (activeIndicators.has('sma') && chartRef.current) {
      try {
        const prices = candleData.map(c => c.close)
        const sma20 = TechnicalIndicatorsCalculator.calculateSMASeries(prices, 20)

        if (sma20.length > 0) {
          const smaSeries = chartRef.current.addLineSeries({
            color: '#2196F3',
            lineWidth: 2,
            title: 'SMA 20',
          })

          const smaData = sma20.map((value, index) => ({
            time: candleData[index].time as Time,
            value,
          }))

          smaSeries.setData(smaData)
          seriesRefs.current.push(smaSeries)
          console.log('SMA series added successfully')
        }
      } catch (error) {
        console.error('Error adding SMA series:', error)
      }
    }

    // Calculate and display EMA if enabled
    if (activeIndicators.has('ema') && chartRef.current) {
      try {
        const prices = candleData.map(c => c.close)
        const ema12 = TechnicalIndicatorsCalculator.calculateEMASeries(prices, 12)

        if (ema12.length > 0) {
          const emaSeries = chartRef.current.addLineSeries({
            color: '#FF6B35',
            lineWidth: 2,
            title: 'EMA 12',
          })

          const emaData = ema12.map((value, index) => ({
            time: candleData[index + (prices.length - ema12.length)].time as Time,
            value,
          }))

          emaSeries.setData(emaData)
          seriesRefs.current.push(emaSeries)
          console.log('EMA series added successfully')
        }
      } catch (error) {
        console.error('Error adding EMA series:', error)
      }
    }

    // Calculate and display Bollinger Bands if enabled
    if (activeIndicators.has('bollinger') && chartRef.current) {
      try {
        const prices = candleData.map(c => c.close)
        const bollinger = TechnicalIndicatorsCalculator.calculateBollingerBandsSeries(prices, 20, 2)

        if (bollinger.upper.length > 0) {
          const bollingerUpperSeries = chartRef.current.addLineSeries({
            color: '#9C27B0',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            title: 'BB Upper',
          })

          const bollingerMiddleSeries = chartRef.current.addLineSeries({
            color: '#9C27B0',
            lineWidth: 1,
            title: 'BB Middle',
          })

          const bollingerLowerSeries = chartRef.current.addLineSeries({
            color: '#9C27B0',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            title: 'BB Lower',
          })

          bollingerUpperSeries.setData(
            bollinger.upper.map((value, index) => ({
              time: candleData[index].time as Time,
              value,
            }))
          )

          bollingerMiddleSeries.setData(
            bollinger.middle.map((value, index) => ({
              time: candleData[index].time as Time,
              value,
            }))
          )

          bollingerLowerSeries.setData(
            bollinger.lower.map((value, index) => ({
              time: candleData[index].time as Time,
              value,
            }))
          )

          seriesRefs.current.push(bollingerUpperSeries, bollingerMiddleSeries, bollingerLowerSeries)
          console.log('Bollinger Bands added successfully')
        }
      } catch (error) {
        console.error('Error adding Bollinger Bands:', error)
      }
    }

    // Calculate and display RSI if enabled
    if (activeIndicators.has('rsi') && rsiChartRef.current) {
      try {
        // Clear RSI chart series
        rsiSeriesRefs.current.forEach(series => {
          if (rsiChartRef.current) {
            rsiChartRef.current.removeSeries(series)
          }
        })
        rsiSeriesRefs.current = []

        const prices = candleData.map(c => c.close)

        const rsiSeries = rsiChartRef.current.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
        })

        // Add reference lines for RSI
        const options = {
          priceScaleId: 'right',
          lastValueVisible: false,
          priceLineVisible: false,
        }

        // Overbought line (70)
        rsiSeries.createPriceLine({
          price: 70,
          color: '#ef5350',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Overbought',
          ...options,
        })

        // Oversold line (30)
        rsiSeries.createPriceLine({
          price: 30,
          color: '#26a69a',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Oversold',
          ...options,
        })

        // Generate RSI data for all points
        const rsiData = []
        for (let i = 14; i < prices.length; i++) {
          const rsi = TechnicalIndicatorsCalculator.calculateRSI(prices.slice(0, i + 1), 14)
          rsiData.push({
            time: candleData[i].time as Time,
            value: rsi,
          })
        }

        if (rsiData.length > 0) {
          rsiSeries.setData(rsiData)
          rsiSeriesRefs.current.push(rsiSeries)
          console.log('RSI series added successfully')
        }
      } catch (error) {
        console.error('Error adding RSI series:', error)
      }
    }

    // Fit content
    try {
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent()
      }
      if (rsiChartRef.current) {
        rsiChartRef.current.timeScale().fitContent()
      }
    } catch (error) {
      console.error('Error fitting content:', error)
    }

  }, [chartReady, selectedCoin, timeframe, activeIndicators, cryptoList])

  const toggleIndicator = (indicator: IndicatorType) => {
    setActiveIndicators(prev => {
      const newSet = new Set(prev)
      if (newSet.has(indicator)) {
        newSet.delete(indicator)
      } else {
        newSet.add(indicator)
      }
      return newSet
    })
  }

  const currentCoin = cryptoList.find(c => c.id === selectedCoin)
  const priceHistory = alertService.getPriceHistory(selectedCoin)
  const currentPrice = currentCoin?.current_price || 0
  const priceChange24h = currentCoin?.price_change_percentage_24h || 0

  // Force re-render when price history updates by watching cryptoList
  // This ensures the empty state disappears once data is available
  const hasData = priceHistory.length > 0

  return (
    <div className="chart-page">
      <div className="chart-header">
        <div className="chart-title-section">
          <h2>Live Chart</h2>
          <div className="coin-selector">
            <select
              value={selectedCoin}
              onChange={(e) => setSelectedCoin(e.target.value)}
              className="coin-select"
            >
              {cryptoList.slice(0, 50).map(coin => (
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
        <div className="timeframe-selector">
          <span className="control-label">Timeframe:</span>
          {(['1m', '5m', '15m', '1h', '4h', '1d'] as Timeframe[]).map(tf => (
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
            Volume
          </button>
          <button
            className={`indicator-btn ${activeIndicators.has('sma') ? 'active' : ''}`}
            onClick={() => toggleIndicator('sma')}
          >
            SMA(20)
          </button>
          <button
            className={`indicator-btn ${activeIndicators.has('ema') ? 'active' : ''}`}
            onClick={() => toggleIndicator('ema')}
          >
            EMA(12)
          </button>
          <button
            className={`indicator-btn ${activeIndicators.has('bollinger') ? 'active' : ''}`}
            onClick={() => toggleIndicator('bollinger')}
          >
            Bollinger Bands
          </button>
          <button
            className={`indicator-btn ${activeIndicators.has('rsi') ? 'active' : ''}`}
            onClick={() => toggleIndicator('rsi')}
          >
            RSI
          </button>
        </div>
      </div>

      <div className="chart-wrapper">
        <div className="chart-container" ref={chartContainerRef} />

        {!chartReady && (
          <div className="chart-empty-state">
            <div className="empty-state-content">
              <div className="loading-spinner"></div>
              <h3>Initializing Chart...</h3>
              <p>Setting up the charting engine</p>
            </div>
          </div>
        )}

        {chartReady && !hasData && (
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
        )}
      </div>

      {activeIndicators.has('rsi') && (
        <div className="rsi-container">
          <div className="rsi-label">RSI (14)</div>
          <div ref={rsiContainerRef} />
        </div>
      )}

      <div className="chart-info">
        <p className="info-text">
          <strong>Tip:</strong> Use the timeframe selector to adjust the candlestick interval.
          Enable indicators to view technical analysis overlays on the chart.
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
): Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> {
  if (priceHistory.length === 0) return []

  // Determine candle duration in milliseconds
  const candleDuration = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
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
    .map(([time, candle]) => ({
      time: Math.floor(Number(time) / 1000), // Convert to seconds for lightweight-charts
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }))
    .sort((a, b) => a.time - b.time)
}
