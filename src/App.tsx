import { useState, useEffect } from 'react'
import './App.css'
import Today from './pages/Today'
import History from './pages/History'
import Settings from './pages/Settings'
import Auth from './pages/Auth'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { migrateLocalDataToSupabase, hasBeenMigrated } from './utils/migration'

type Page = 'today' | 'history' | 'settings'

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('today')
  const [migrating, setMigrating] = useState(false)
  const { user, loading, signOut } = useAuth()

  useEffect(() => {
    // Migrate local data when user logs in for the first time
    if (user && !hasBeenMigrated()) {
      setMigrating(true)
      migrateLocalDataToSupabase().then(() => {
        setMigrating(false)
      })
    }
  }, [user])

  if (loading || migrating) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <span className="loading-icon">🥗</span>
          <p>{migrating ? 'Migrating your data...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth />
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'today':
        return <Today />
      case 'history':
        return <History />
      case 'settings':
        return <Settings />
      default:
        return <Today />
    }
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand">
          <span className="brand-icon">🥗</span>
          <h1>Macro Tracker</h1>
        </div>
        <div className="nav-links">
          <button
            className={`nav-link ${currentPage === 'today' ? 'active' : ''}`}
            onClick={() => setCurrentPage('today')}
          >
            <span className="nav-icon">📊</span>
            Today
          </button>
          <button
            className={`nav-link ${currentPage === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentPage('history')}
          >
            <span className="nav-icon">📅</span>
            History
          </button>
          <button
            className={`nav-link ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentPage('settings')}
          >
            <span className="nav-icon">⚙️</span>
            Settings
          </button>
          <button
            className="nav-link logout"
            onClick={signOut}
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
