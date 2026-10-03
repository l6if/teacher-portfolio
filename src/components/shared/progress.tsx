'use client'

import { useEffect, useState } from 'react'

export function ProgressRing({
  value,
  size = 168,
  thickness = 13,
  label,
  sublabel,
}: {
  value: number
  size?: number
  thickness?: number
  label?: string
  sublabel?: string
}) {
  const [animated, setAnimated] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(value), 120)
    return () => clearTimeout(t)
  }, [value])

  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const offset = c - (animated / 100) * c

  return (
    <div className="relative inline-flex items-center justify-center" role="img" aria-label={`نسبة الاكتمال ${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="currentColor"
          className="text-primary/10 transition-all duration-700"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="url(#ring-gradient)"
          strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1B2A41" />
            <stop offset="100%" stopColor="#B8956A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-primary tabular-nums tracking-tight">
          {label ?? `${value}%`}
        </span>
        {sublabel && <span className="text-xs text-muted-foreground mt-1">{sublabel}</span>}
      </div>
    </div>
  )
}

export function ProgressBar({ value, className = '', thickness = 'h-2' }: { value: number; className?: string; thickness?: string }) {
  const [animated, setAnimated] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setAnimated(value), 100)
    return () => clearTimeout(t)
  }, [value])
  return (
    <div
      className={`w-full rounded-full bg-primary/10 overflow-hidden ${thickness} ${className}`}
      role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-l from-[#1B2A41] to-[#B8956A]"
        style={{ width: `${animated}%`, transition: 'width 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
    </div>
  )
}
