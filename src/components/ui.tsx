import type { ReactNode } from 'react'

type Tone = 'primary' | 'neutral' | 'secondary' | 'danger' | 'warning'

const TONES: Record<Tone, string> = {
  primary: 'border-emerald-400/50 bg-emerald-600 text-white hover:bg-emerald-500',
  neutral: 'border-line bg-panel-2 text-slate-100 hover:bg-slate-700',
  secondary: 'border-line bg-panel-2 text-slate-100 hover:bg-slate-700',
  danger: 'border-rose-400/50 bg-rose-700 text-white hover:bg-rose-600',
  warning: 'border-amber-300/50 bg-amber-500 text-black hover:bg-amber-400',
}

export function Button({
  children,
  onClick,
  tone = 'neutral',
  disabled = false,
  className = '',
}: {
  children: ReactNode
  onClick: () => void
  tone?: Tone
  disabled?: boolean
  className?: string
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex min-h-[56px] items-center justify-center rounded-lg border-2 px-3 py-2 text-base font-black',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        TONES[tone],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function Panel({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}): React.ReactElement {
  return (
    <section className={`rounded-lg border border-line bg-panel p-4 ${className}`}>
      {title !== undefined && <h2 className="mb-3 text-lg font-black text-white">{title}</h2>}
      {children}
    </section>
  )
}

export function Notice({ children }: { children?: ReactNode }): React.ReactElement {
  return (
    <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-200">
      {children ??
        '本系統為訓練、模擬賽及賽事輔助工具，並非 World Taekwondo 認證電子計分設備。正式賽事仍應依主辦單位最新競賽規程及認可設備辦理。'}
    </p>
  )
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1 text-sm font-bold text-slate-300">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[48px] rounded-lg border border-line bg-panel-2 px-3 text-white outline-none focus:border-emerald-400"
      />
    </label>
  )
}
