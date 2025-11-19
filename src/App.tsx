import { useState, useEffect } from 'react'
import './App.css'
import Dashboard from './pages/Dashboard'
import Watchlist from './pages/Watchlist'
import CryptoSettings from './pages/CryptoSettings'
import Auth from './pages/Auth'
import AlertHistory from './components/AlertHistory'
import TradeCalculator from './components/TradeCalculator'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useCryptoStore } from './stores/cryptoStore'

type Page = 'dashboard' | 'watchlist' | 'alerts' | 'calculator' | 'settings'

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const { user, loading, signOut } = useAuth()
  const { settings } = useCryptoStore()

  useEffect(() => {
    // Apply theme on mount
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  if (loading) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <span className="loading-icon">₿</span>
          <p>Loading Crypto Dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth />
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />
      case 'watchlist':
        return <Watchlist />
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
          <button
            className="nav-link logout"
            onClick={signOut}
            title="Logout"
          >
            <span className="nav-icon">🚪</span>
            Logout
          </button>
        </div>
      </nav>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
