import { useState } from 'react'
import './App.css'
import Today from './pages/Today'
import History from './pages/History'
import Settings from './pages/Settings'

type Page = 'today' | 'history' | 'settings'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('today')

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
        </div>
      </nav>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
