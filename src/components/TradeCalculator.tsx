import { useState } from 'react'
import type { TradeCalculation } from '../types/crypto'

export default function TradeCalculator() {
  const [entryPrice, setEntryPrice] = useState<string>('')
  const [exitPrice, setExitPrice] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('')
  const [feePercent, setFeePercent] = useState<string>('0.1')

  const [result, setResult] = useState<TradeCalculation | null>(null)

  const calculateTrade = () => {
    const entry = parseFloat(entryPrice)
    const exit = parseFloat(exitPrice)
    const qty = parseFloat(quantity)
    const fee = parseFloat(feePercent)

    if (isNaN(entry) || isNaN(exit) || isNaN(qty) || entry <= 0 || qty <= 0) {
      alert('Please enter valid values')
      return
    }

    const entryValue = entry * qty
    const exitValue = exit * qty
    const feeAmount = (entryValue + exitValue) * (fee / 100)
    const profit = exitValue - entryValue - feeAmount
    const profitPercent = (profit / entryValue) * 100

    setResult({
      entryPrice: entry,
      exitPrice: exit,
      quantity: qty,
      profit,
      profitPercent,
      fees: feeAmount,
    })
  }

  const reset = () => {
    setEntryPrice('')
    setExitPrice('')
    setQuantity('')
    setFeePercent('0.1')
    setResult(null)
  }

  return (
    <div className="trade-calculator">
      <div className="calculator-header">
        <h2>Trade Calculator</h2>
        <p className="calculator-description">Calculate potential profit/loss for your trades</p>
      </div>

      <div className="calculator-inputs">
        <div className="input-group">
          <label htmlFor="entry-price">Entry Price ($)</label>
          <input
            id="entry-price"
            type="number"
            step="any"
            placeholder="0.00"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            className="calculator-input"
          />
        </div>

        <div className="input-group">
          <label htmlFor="exit-price">Exit Price ($)</label>
          <input
            id="exit-price"
            type="number"
            step="any"
            placeholder="0.00"
            value={exitPrice}
            onChange={(e) => setExitPrice(e.target.value)}
            className="calculator-input"
          />
        </div>

        <div className="input-group">
          <label htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            type="number"
            step="any"
            placeholder="0.00"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="calculator-input"
          />
        </div>

        <div className="input-group">
          <label htmlFor="fee">Trading Fee (%)</label>
          <input
            id="fee"
            type="number"
            step="0.01"
            placeholder="0.1"
            value={feePercent}
            onChange={(e) => setFeePercent(e.target.value)}
            className="calculator-input"
          />
        </div>
      </div>

      <div className="calculator-actions">
        <button onClick={calculateTrade} className="calculate-btn">
          Calculate
        </button>
        <button onClick={reset} className="reset-btn">
          Reset
        </button>
      </div>

      {result && (
        <div className="calculator-result">
          <h3>Trade Summary</h3>

          <div className="result-grid">
            <div className="result-item">
              <span className="result-label">Entry Value</span>
              <span className="result-value">
                ${(result.entryPrice * result.quantity).toFixed(2)}
              </span>
            </div>

            <div className="result-item">
              <span className="result-label">Exit Value</span>
              <span className="result-value">
                ${(result.exitPrice * result.quantity).toFixed(2)}
              </span>
            </div>

            <div className="result-item">
              <span className="result-label">Trading Fees</span>
              <span className="result-value">${result.fees?.toFixed(2) || '0.00'}</span>
            </div>

            <div className={`result-item profit ${result.profit >= 0 ? 'positive' : 'negative'}`}>
              <span className="result-label">Net Profit/Loss</span>
              <span className="result-value profit-value">
                {result.profit >= 0 ? '+' : ''}${result.profit.toFixed(2)}
              </span>
            </div>

            <div className={`result-item profit ${result.profit >= 0 ? 'positive' : 'negative'}`}>
              <span className="result-label">Return</span>
              <span className="result-value profit-percent">
                {result.profitPercent >= 0 ? '+' : ''}
                {result.profitPercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {result.profit >= 0 ? (
            <div className="result-message success">
              Potential profit of ${result.profit.toFixed(2)} ({result.profitPercent.toFixed(2)}%)
            </div>
          ) : (
            <div className="result-message loss">
              Potential loss of ${Math.abs(result.profit).toFixed(2)} (
              {result.profitPercent.toFixed(2)}%)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
