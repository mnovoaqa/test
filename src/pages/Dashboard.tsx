import { useEffect, useState, useMemo } from 'react'
import { useCryptoStore } from '../stores/cryptoStore'
import CryptoCard from '../components/CryptoCard'

export default function Dashboard() {
  const {
    cryptoList,
    loading,
    error,
    fetchCryptoData,
    sortBy,
    sortOrder,
    setSortBy,
    toggleSortOrder,
    filterText,
    setFilterText,
  } = useCryptoStore()

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    fetchCryptoData()

    // Set up periodic refresh
    const interval = setInterval(() => {
      fetchCryptoData()
    }, 60000) // Refresh every minute

    return () => clearInterval(interval)
  }, [fetchCryptoData])

  // Filtered and sorted crypto list
  const filteredAndSortedList = useMemo(() => {
    let list = [...cryptoList]

    // Filter
    if (filterText) {
      const searchTerm = filterText.toLowerCase()
      list = list.filter(
        (crypto) =>
          crypto.name.toLowerCase().includes(searchTerm) ||
          crypto.symbol.toLowerCase().includes(searchTerm)
      )
    }

    // Sort
    list.sort((a, b) => {
      let aValue: number
      let bValue: number

      switch (sortBy) {
        case 'market_cap':
          aValue = a.market_cap
          bValue = b.market_cap
          break
        case 'price':
          aValue = a.current_price
          bValue = b.current_price
          break
        case 'change_24h':
          aValue = a.price_change_percentage_24h
          bValue = b.price_change_percentage_24h
          break
        case 'change_1h':
          aValue = a.price_change_percentage_1h_in_currency || 0
          bValue = b.price_change_percentage_1h_in_currency || 0
          break
        case 'volume':
          aValue = a.total_volume
          bValue = b.total_volume
          break
        default:
          aValue = a.market_cap_rank
          bValue = b.market_cap_rank
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
    })

    return list
  }, [cryptoList, sortBy, sortOrder, filterText])

  if (error) {
    return (
      <div className="dashboard-error">
        <div className="error-icon">⚠️</div>
        <h2>Error Loading Crypto Data</h2>
        <p>{error}</p>
        <button onClick={() => fetchCryptoData()} className="retry-btn">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-title">
          <h1>Live Crypto Dashboard</h1>
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span className="status-text">Real-time Updates</span>
          </div>
        </div>

        <div className="header-controls">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search cryptocurrency..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              ⊞
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-filters">
        <div className="sort-controls">
          <span className="sort-label">Sort by:</span>
          <button
            className={`sort-btn ${sortBy === 'market_cap' ? 'active' : ''}`}
            onClick={() => setSortBy('market_cap')}
          >
            Market Cap
          </button>
          <button
            className={`sort-btn ${sortBy === 'price' ? 'active' : ''}`}
            onClick={() => setSortBy('price')}
          >
            Price
          </button>
          <button
            className={`sort-btn ${sortBy === 'change_24h' ? 'active' : ''}`}
            onClick={() => setSortBy('change_24h')}
          >
            24h Change
          </button>
          <button
            className={`sort-btn ${sortBy === 'change_1h' ? 'active' : ''}`}
            onClick={() => setSortBy('change_1h')}
          >
            1h Change
          </button>
          <button
            className={`sort-btn ${sortBy === 'volume' ? 'active' : ''}`}
            onClick={() => setSortBy('volume')}
          >
            Volume
          </button>
          <button className="order-btn" onClick={toggleSortOrder} title="Toggle Order">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        <div className="crypto-count">
          Showing {filteredAndSortedList.length} cryptocurrencies
        </div>
      </div>

      {loading && cryptoList.length === 0 ? (
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading cryptocurrency data...</p>
        </div>
      ) : (
        <div className={`crypto-${viewMode}`}>
          {filteredAndSortedList.map((crypto) => (
            <CryptoCard key={crypto.id} crypto={crypto} />
          ))}
        </div>
      )}

      {filteredAndSortedList.length === 0 && !loading && (
        <div className="no-results">
          <div className="no-results-icon">🔍</div>
          <h3>No cryptocurrencies found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  )
}
