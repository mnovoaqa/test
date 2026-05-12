import { useState, useEffect } from 'react'
import './App.css'
import Dashboard from './pages/Dashboard'
import Watchlist from './pages/Watchlist'
import CryptoSettings from './pages/CryptoSettings'
import Chart from './pages/Chart'
import AlertHistory from './components/AlertHistory'
import TradeCalculator from './components/TradeCalculator'
import { useCryptoStore } from './stores/cryptoStore'

type Page = 'dashboard' | 'watchlist' | 'chart' | 'alerts' | 'calculator' | 'settings'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [selectedChartCoin, setSelectedChartCoin] = useState<string | null>(null)
  const { settings } = useCryptoStore()

  useEffect(() => {
    // Apply theme on mount
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  const navigateToChart = (coinId?: string) => {
    setCurrentPage('chart')
    if (coinId) {
      setSelectedChartCoin(coinId)
    }
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigateToChart={navigateToChart} />
      case 'watchlist':
        return <Watchlist onNavigateToChart={navigateToChart} />
      case 'chart':
        return <Chart initialCoinId={selectedChartCoin} />
      case 'alerts':
        return <AlertHistory />
      case 'calculator':
        return <TradeCalculator />
      case 'settings':
        return <CryptoSettings />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">
          <span className="brand-icon">₿</span>
          <h1>Crypto Alert Dashboard</h1>
        </div>
        <div className="nav-links">
          <button
            className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
            title="Dashboard"
          >
            <span className="nav-icon">📊</span>
            Dashboard
          </button>
          <button
            className={`nav-link ${currentPage === 'watchlist' ? 'active' : ''}`}
            onClick={() => setCurrentPage('watchlist')}
            title="Watchlist"
          >
            <span className="nav-icon">⭐</span>
            Watchlist
          </button>
          <button
            className={`nav-link ${currentPage === 'chart' ? 'active' : ''}`}
            onClick={() => setCurrentPage('chart')}
            title="Live Chart"
          >
            <span className="nav-icon">📈</span>
            Chart
          </button>
          <button
            className={`nav-link ${currentPage === 'alerts' ? 'active' : ''}`}
            onClick={() => setCurrentPage('alerts')}
            title="Alerts"
          >
            <span className="nav-icon">🔔</span>
            Alerts
          </button>
          <button
            className={`nav-link ${currentPage === 'calculator' ? 'active' : ''}`}
            onClick={() => setCurrentPage('calculator')}
            title="Trade Calculator"
          >
            <span className="nav-icon">🧮</span>
            Calculator
          </button>
          <button
            className={`nav-link ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentPage('settings')}
            title="Settings"
          >
            <span className="nav-icon">⚙️</span>
            Settings
          </button>
        </div>
      </nav>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
