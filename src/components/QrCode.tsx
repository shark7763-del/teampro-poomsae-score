import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function QrCode({
  value,
  label = 'QR Code',
  size = 148,
}: {
  value: string
  label?: string
  size?: number
}): React.ReactElement {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: '#05070c', light: '#ffffff' },
    }).then((url) => {
      if (!cancelled) setDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [size, value])

  return (
    <figure className="flex flex-col items-center gap-2 rounded-lg border border-line bg-panel-2 p-3">
      <figcaption className="text-sm font-black text-white">{label}</figcaption>
      {dataUrl === null ? (
        <div className="animate-pulse rounded bg-slate-700" style={{ width: size, height: size }} />
      ) : (
        <img src={dataUrl} alt={`${label} QR Code`} width={size} height={size} className="rounded" />
      )}
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(value)}
        className="min-h-[44px] w-full rounded-lg border border-line bg-panel px-2 text-xs font-bold text-slate-200"
      >
        複製連結
      </button>
    </figure>
  )
}
