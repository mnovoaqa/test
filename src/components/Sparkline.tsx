import { useEffect, useRef } from 'react'
import type { PriceHistory } from '../types/crypto'

interface SparklineProps {
  data: PriceHistory[]
  width?: number
  height?: number
  color?: string
}

export default function Sparkline({
  data,
  width = 100,
  height = 40,
  color = '#10b981',
}: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || data.length < 2) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Get price values
    const prices = data.map((d) => d.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice

    if (priceRange === 0) return

    // Calculate points
    const points: { x: number; y: number }[] = []
    const xStep = width / (prices.length - 1)

    prices.forEach((price, index) => {
      const x = index * xStep
      const y = height - ((price - minPrice) / priceRange) * height
      points.push({ x, y })
    })

    // Draw line
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y)
      } else {
        ctx.lineTo(point.x, point.y)
      }
    })

    ctx.stroke()

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, `${color}40`)
    gradient.addColorStop(1, `${color}00`)

    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()
  }, [data, width, height, color])

  if (data.length < 2) {
    return <div style={{ width, height }} />
  }

  return <canvas ref={canvasRef} width={width} height={height} className="sparkline" />
}
