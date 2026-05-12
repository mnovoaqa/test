import type { CryptoPrice } from '../types/crypto'

export type PriceUpdateCallback = (data: CryptoPrice) => void

class BinanceWebSocketService {
  private ws: WebSocket | null = null
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private readonly MAX_RECONNECT_ATTEMPTS = 5
  private readonly RECONNECT_DELAY = 5000
  private subscribers: Map<string, Set<PriceUpdateCallback>> = new Map()
  private subscribedSymbols: Set<string> = new Set()
  private isConnecting = false

  constructor() {
    this.connect()
  }

  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return
    }

    this.isConnecting = true

    try {
      // Connect to Binance WebSocket stream
      this.ws = new WebSocket('wss://stream.binance.com:9443/ws')

      this.ws.onopen = () => {
        console.log('Binance WebSocket connected')
        this.isConnecting = false
        this.reconnectAttempts = 0

        // Resubscribe to all symbols
        if (this.subscribedSymbols.size > 0) {
          this.subscribeToSymbols(Array.from(this.subscribedSymbols))
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Handle ticker data
          if (data.e === '24hrTicker') {
            const symbol = data.s.toLowerCase()
            const priceData: CryptoPrice = {
              symbol: symbol,
              price: parseFloat(data.c),
              timestamp: data.E,
              volume: parseFloat(data.v),
            }

            // Notify all subscribers for this symbol
            const callbacks = this.subscribers.get(symbol)
            if (callbacks) {
              callbacks.forEach((callback) => callback(priceData))
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('Binance WebSocket error:', error)
      }

      this.ws.onclose = () => {
        console.log('Binance WebSocket disconnected')
        this.isConnecting = false
        this.ws = null
        this.attemptReconnect()
      }
    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      this.isConnecting = false
      this.attemptReconnect()
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`)

    this.reconnectTimeout = setTimeout(() => {
      this.connect()
    }, this.RECONNECT_DELAY * this.reconnectAttempts)
  }

  private subscribeToSymbols(symbols: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, queuing subscription')
      return
    }

    // Subscribe to 24hr ticker for all symbols
    const streams = symbols.map((symbol) => `${symbol.toLowerCase()}usdt@ticker`)

    const subscribeMessage = {
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now(),
    }

    this.ws.send(JSON.stringify(subscribeMessage))
    symbols.forEach((symbol) => this.subscribedSymbols.add(symbol))
  }

  private unsubscribeFromSymbols(symbols: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    const streams = symbols.map((symbol) => `${symbol.toLowerCase()}usdt@ticker`)

    const unsubscribeMessage = {
      method: 'UNSUBSCRIBE',
      params: streams,
      id: Date.now(),
    }

    this.ws.send(JSON.stringify(unsubscribeMessage))
    symbols.forEach((symbol) => this.subscribedSymbols.delete(symbol))
  }

  subscribe(symbol: string, callback: PriceUpdateCallback): () => void {
    const normalizedSymbol = symbol.toLowerCase()

    if (!this.subscribers.has(normalizedSymbol)) {
      this.subscribers.set(normalizedSymbol, new Set())
    }

    this.subscribers.get(normalizedSymbol)!.add(callback)

    // Subscribe to the symbol if not already subscribed
    if (!this.subscribedSymbols.has(normalizedSymbol)) {
      this.subscribeToSymbols([normalizedSymbol])
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(normalizedSymbol)
      if (callbacks) {
        callbacks.delete(callback)

        // If no more subscribers for this symbol, unsubscribe from WebSocket
        if (callbacks.size === 0) {
          this.subscribers.delete(normalizedSymbol)
          this.unsubscribeFromSymbols([normalizedSymbol])
        }
      }
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.subscribers.clear()
    this.subscribedSymbols.clear()
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

export const binanceWebSocket = new BinanceWebSocketService()
