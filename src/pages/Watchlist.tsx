import { useState } from 'react'
import { useCryptoStore } from '../stores/cryptoStore'
import CryptoCard from '../components/CryptoCard'
import type { Watchlist as WatchlistType } from '../types/crypto'

interface WatchlistProps {
  onNavigateToChart?: (coinId: string) => void
}

export default function Watchlist({ onNavigateToChart }: WatchlistProps) {
  const { cryptoList, settings, addToWatchlist, removeFromWatchlist } = useCryptoStore()
  const [selectedWatchlist, setSelectedWatchlist] = useState<string | null>(
    settings.watchlists[0]?.id || null
  )
  const [isCreating, setIsCreating] = useState(false)
  const [newWatchlistName, setNewWatchlistName] = useState('')

  const currentWatchlist = settings.watchlists.find((w) => w.id === selectedWatchlist)

  const watchlistCoins = cryptoList.filter((crypto) =>
    currentWatchlist?.coinIds.includes(crypto.id)
  )

  const handleCreateWatchlist = () => {
    if (!newWatchlistName.trim()) {
      alert('Please enter a watchlist name')
      return
    }

    const newWatchlist: WatchlistType = {
      id: `watchlist_${Date.now()}`,
      name: newWatchlistName,
      coinIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    addToWatchlist(newWatchlist)
    setSelectedWatchlist(newWatchlist.id)
    setNewWatchlistName('')
    setIsCreating(false)
  }

  const handleDeleteWatchlist = (watchlistId: string) => {
    if (window.confirm('Are you sure you want to delete this watchlist?')) {
      removeFromWatchlist(watchlistId)
      if (selectedWatchlist === watchlistId) {
        setSelectedWatchlist(settings.watchlists[0]?.id || null)
      }
    }
  }

  return (
    <div className="watchlist-page">
      <div className="watchlist-sidebar">
        <div className="sidebar-header">
          <h2>Watchlists</h2>
          <button onClick={() => setIsCreating(true)} className="create-watchlist-btn">
            +
          </button>
        </div>

        {isCreating && (
          <div className="create-watchlist-form">
            <input
              type="text"
              placeholder="Watchlist name"
              value={newWatchlistName}
              onChange={(e) => setNewWatchlistName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateWatchlist()}
              autoFocus
              className="watchlist-name-input"
            />
            <div className="form-actions">
              <button onClick={handleCreateWatchlist} className="save-btn">
                Save
              </button>
              <button
                onClick={() => {
                  setIsCreating(false)
                  setNewWatchlistName('')
                }}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="watchlist-list">
          {settings.watchlists.map((watchlist) => (
            <div
              key={watchlist.id}
              className={`watchlist-item ${
                selectedWatchlist === watchlist.id ? 'active' : ''
              }`}
            >
              <button
                onClick={() => setSelectedWatchlist(watchlist.id)}
                className="watchlist-name"
              >
                <span>{watchlist.name}</span>
                <span className="coin-count">{watchlist.coinIds.length}</span>
              </button>
              <button
                onClick={() => handleDeleteWatchlist(watchlist.id)}
                className="delete-watchlist-btn"
                title="Delete watchlist"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {settings.watchlists.length === 0 && !isCreating && (
          <div className="no-watchlists">
            <p>No watchlists yet</p>
            <p className="hint">Click + to create one</p>
          </div>
        )}
      </div>

      <div className="watchlist-content">
        {currentWatchlist ? (
          <>
            <div className="watchlist-header">
              <h1>{currentWatchlist.name}</h1>
              <div className="watchlist-info">
                {watchlistCoins.length} cryptocurrencies
              </div>
            </div>

            {watchlistCoins.length > 0 ? (
              <div className="crypto-grid">
                {watchlistCoins.map((crypto) => (
                  <CryptoCard
                    key={crypto.id}
                    crypto={crypto}
                    onNavigateToChart={onNavigateToChart}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-watchlist">
                <div className="empty-icon">📝</div>
                <h3>Empty Watchlist</h3>
                <p>Add cryptocurrencies to this watchlist from the Dashboard</p>
              </div>
            )}
          </>
        ) : (
          <div className="no-watchlist-selected">
            <div className="empty-icon">👈</div>
            <h3>No Watchlist Selected</h3>
            <p>Select or create a watchlist to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}
