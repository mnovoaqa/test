# Crypto Alert Dashboard - Intelligent Alerting System

## Overview

The dashboard now features a **professional-grade alerting system** that uses persistent baseline tracking and momentum-based detection to provide meaningful, actionable alerts—similar to TradingView, Bloomberg Terminal, and other professional trading platforms.

## Key Improvements

### 1. **Persistent Baseline Tracking**
- **Problem Solved**: Price percentage changes no longer reset to zero on every refresh
- **How it Works**:
  - Each cryptocurrency has a persistent baseline price stored in localStorage
  - Baseline is set when you first load the coin
  - Percentage changes are always calculated from this baseline
  - Baseline auto-resets after 4 hours or >10% movement to stay relevant

### 2. **Extended Price History**
- **Before**: Only 16 minutes of price history (100 points × 10s)
- **After**: 4+ hours of price history (1440 points)
- **Benefit**: Enables accurate trend analysis and momentum detection

### 3. **Momentum-Based Alert Detection**

Instead of triggering on every 3% move, the system now uses intelligent momentum analysis:

#### Alert Types:

**🚀 Parabolic Movement** (Rare, Critical)
- Triggers when: ≥5% move in 15 minutes with rapid acceleration
- Use case: Extreme buying/selling pressure - act immediately
- Cooldown: 10 minutes
- Example: "🚀 PARABOLIC: +5.2% in 15 min - Strong buying pressure"

**📈 Strong Upward Momentum** (Buy Signal)
- Triggers when: ≥3% short-term + ≥1.5% medium-term with 75%+ confidence
- Use case: Good entry point for position building
- Cooldown: 10 minutes
- Example: "📈 STRONG BUY: +3.4% - Consider entry"

**📉 Strong Downward Momentum** (Sell Signal)
- Triggers when: ≤-3% short-term + ≤-1.5% medium-term with 75%+ confidence
- Use case: Protect capital, consider exit
- Cooldown: 10 minutes
- Example: "📉 STRONG SELL: -3.8% - Protect capital"

**📊 Volume Spike with Trend** (Confirmation Signal)
- Triggers when: Volume >200% above average AND price trend is non-neutral
- Use case: Confirms ongoing trend strength
- Cooldown: 10 minutes

**💎 RSI Oversold** (Reversal Signal)
- Triggers when: RSI < 30 AND bearish trend
- Use case: Potential bounce opportunity for contrarian plays
- Cooldown: 10 minutes

**💰 RSI Overbought** (Take Profit Signal)
- Triggers when: RSI > 70 AND bullish trend
- Use case: Consider taking profits
- Cooldown: 10 minutes

### 4. **Smart Spam Prevention**

Multiple layers prevent alert spam:

1. **Cooldown Period**: 10 minutes between alerts of same type for same coin
2. **Momentum Change Detection**: Won't re-alert for the same momentum type
3. **Trend Confirmation**: Requires multiple timeframes to align
4. **Confidence Thresholds**: Only triggers when confidence ≥70-75%

### 5. **Multi-Timeframe Analysis**

Each alert considers three timeframes:
- **Short-term**: 15 minutes (immediate momentum)
- **Medium-term**: 1 hour (trend confirmation)
- **Long-term**: 4 hours (confidence boosting)

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ baselineTracker.ts                                         │
│ - Persistent baseline storage (localStorage)              │
│ - Extended price history (1440 points)                    │
│ - Momentum analysis engine                                │
│ - Trend detection across timeframes                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ alertService.ts                                            │
│ - Momentum-based alert triggers                           │
│ - Smart spam prevention                                   │
│ - 10-minute cooldown periods                              │
│ - Confidence-based filtering                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ cryptoStore.ts                                             │
│ - Integrates baseline tracking                            │
│ - Updates percentage from baseline (not 24h API)          │
│ - Preserves state across updates                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Dashboard.tsx                                              │
│ - Removed periodic refresh (was wiping state)             │
│ - Single initialization on mount                          │
│ - Poller handles all updates                              │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

Default alert thresholds (can be customized):

```typescript
{
  priceChangeThreshold: 3,      // No longer used directly
  priceChangeWindow: 5,          // Window for legacy checks
  volumeSpike: 200,              // 200% above average
  rsiOversold: 30,               // RSI oversold threshold
  rsiOverbought: 70,             // RSI overbought threshold
  enableSound: true,
  enablePush: true,
  enableWebhook: false
}
```

Internal momentum thresholds:
- Parabolic: ±5% in 15 minutes
- Strong move: ±3% in 15 minutes
- Consolidation: <0.5% movement

## Usage Examples

### Understanding Your Alerts

**When you see: "🚀 PARABOLIC: +5.2% in 15 min"**
- Action: Check charts immediately
- Decision: Consider quick entry if fundamentals support, or prepare for reversal

**When you see: "📈 STRONG BUY: +3.4%"**
- Action: Review entry point
- Decision: Good time to add to position or start building one

**When you see: "📉 STRONG SELL: -3.8%"**
- Action: Review stop-loss
- Decision: Consider reducing exposure or exiting if trend breaks

**When you see: "💰 OVERBOUGHT: RSI 72.3"**
- Action: Check profit targets
- Decision: Consider taking partial profits

### Resetting Baselines

Baselines automatically reset:
- After 4 hours (keeps data fresh)
- After >10% movement (prevents stale comparisons)

To manually clear all baselines:
```javascript
// In browser console
baselineTracker.clearAllBaselines()
```

## Benefits Over Previous System

| Aspect | Before | After |
|--------|--------|-------|
| **Baseline** | Reset every 60s | Persistent (localStorage) |
| **History** | 16 minutes | 4+ hours |
| **Alerts** | Every 3% move | Momentum-based with confidence |
| **Spam** | High (5-min cooldown only) | Low (10-min cooldown + momentum checks) |
| **Accuracy** | Low (short history) | High (multi-timeframe analysis) |
| **Actionability** | Mixed signals | Clear buy/sell/neutral signals |

## Data Persistence

- **Baselines**: Stored in localStorage as `crypto_baselines`
- **Settings**: Stored in localStorage as `cryptoSettings`
- **Survives**: Page refreshes, browser restarts
- **Cleared**: When you clear browser data or manually reset

## Performance Impact

- **Memory**: ~144KB per 100 coins (1440 points × 100 coins)
- **Storage**: ~5KB in localStorage for baselines
- **CPU**: Negligible (analysis runs on price updates only)
- **Network**: No change (same polling frequency)

## Future Enhancements

Potential additions:
- Custom alert thresholds per coin
- Machine learning for pattern recognition
- Push notifications to mobile devices
- Webhook integration for automated trading
- Multi-exchange price aggregation
- Social sentiment analysis integration
