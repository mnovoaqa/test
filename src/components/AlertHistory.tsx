import { useState, useEffect } from 'react'
import type { Alert } from '../types/crypto'
import { alertService } from '../services/alertService'
import { useCryptoStore } from '../stores/cryptoStore'

export default function AlertHistory() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; coinId: string; coinName: string } | null>(null)
  const { clearAlerts } = useCryptoStore()

  useEffect(() => {
    // Load initial alerts
    setAlerts(alertService.getAlertHistory())

    // Subscribe to new alerts
    const unsubscribe = alertService.onAlert(() => {
      setAlerts(alertService.getAlertHistory())
    })

    // Close context menu on click outside
    const handleClickOutside = () => {
      setContextMenu(null)
    }
    document.addEventListener('click', handleClickOutside)

    return () => {
      unsubscribe()
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    // Less than a minute
    if (diff < 60000) {
      return 'Just now'
    }

    // Less than an hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    }

    // Less than a day
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    }

    // More than a day
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'price_spike':
        return '📈'
      case 'volume_spike':
        return '📊'
      case 'rsi_oversold':
        return '📉'
      case 'rsi_overbought':
        return '🔥'
      default:
        return '🔔'
    }
  }

  const getAlertTypeLabel = (type: Alert['type']) => {
    switch (type) {
      case 'price_spike':
        return 'Price Alert'
      case 'volume_spike':
        return 'Volume Alert'
      case 'rsi_oversold':
        return 'RSI Oversold'
      case 'rsi_overbought':
        return 'RSI Overbought'
      default:
        return 'Alert'
    }
  }

  const handleClearAlerts = () => {
    if (window.confirm('Are you sure you want to clear all alerts?')) {
      clearAlerts()
      setAlerts([])
    }
  }

  const handleContextMenu = (e: React.MouseEvent, coinId: string, coinName: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      coinId,
      coinName
    })
  }

  const handleMuteCoin = () => {
    if (contextMenu) {
      alertService.muteCoin(contextMenu.coinId)
      setContextMenu(null)
    }
  }

  const handleUnmuteCoin = () => {
    if (contextMenu) {
      alertService.unmuteCoin(contextMenu.coinId)
      setContextMenu(null)
    }
  }

  const getExchangeLink = (symbol: string, exchange: 'binance' | 'coinbase' | 'kraken') => {
    const symbolLower = symbol.toLowerCase()
    switch (exchange) {
      case 'binance':
        return `https://www.binance.com/en/trade/${symbolLower}_USDT`
      case 'coinbase':
        return `https://www.coinbase.com/price/${symbolLower}`
      case 'kraken':
        return `https://www.kraken.com/prices/${symbolLower}`
      default:
        return '#'
    }
  }

  if (alerts.length === 0) {
    return (
      <div className="alert-history-empty">
        <div className="empty-icon">🔕</div>
        <h3>No Alerts Yet</h3>
        <p>Alerts will appear here when parabolic movements are detected</p>
      </div>
    )
  }

  return (
    <div className="alert-history">
      <div className="alert-history-header">
        <h2>Alert History</h2>
        <button onClick={handleClearAlerts} className="clear-alerts-btn">
          Clear All
        </button>
      </div>

      <div className="alerts-list">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`alert-item ${alert.type} ${alertService.isCoinMuted(alert.coinId) ? 'muted' : ''}`}
            onContextMenu={(e) => handleContextMenu(e, alert.coinId, alert.coinName)}
          >
            <div className="alert-icon">{getAlertIcon(alert.type)}</div>

            <div className="alert-content">
              <div className="alert-header">
                <div className="alert-coin">
                  <span className="alert-symbol">{alert.coinSymbol}</span>
                  <span className="alert-name">{alert.coinName}</span>
                </div>
                <span className="alert-type">{getAlertTypeLabel(alert.type)}</span>
              </div>

              <div className="alert-message">{alert.message}</div>

              <div className="alert-details">
                <span className="alert-price">
                  ${alert.price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                </span>
                {alert.priceChangePercent !== undefined && (
                  <span
                    className={`alert-change ${
                      alert.priceChangePercent >= 0 ? 'positive' : 'negative'
                    }`}
                  >
                    {alert.priceChangePercent >= 0 ? '+' : ''}
                    {alert.priceChangePercent.toFixed(2)}%
                  </span>
                )}
                {alert.rsi !== undefined && (
                  <span className="alert-rsi">RSI: {alert.rsi.toFixed(2)}</span>
                )}
              </div>

              <div className="alert-actions">
                <a
                  href={getExchangeLink(alert.coinSymbol, 'binance')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="exchange-link"
                >
                  Trade on Binance
                </a>
                <a
                  href={getExchangeLink(alert.coinSymbol, 'coinbase')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="exchange-link"
                >
                  Trade on Coinbase
                </a>
              </div>

              <div className="alert-time">{formatTime(alert.timestamp)}</div>
            </div>
          </div>
        ))}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-header">{contextMenu.coinName}</div>
          {alertService.isCoinMuted(contextMenu.coinId) ? (
            <button className="context-menu-item" onClick={handleUnmuteCoin}>
              🔔 Unmute Alerts
            </button>
          ) : (
            <button className="context-menu-item" onClick={handleMuteCoin}>
              🔕 Mute Alerts
            </button>
          )}
        </div>
      )}
    </div>
  )
}
