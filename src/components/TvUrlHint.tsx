import { useState } from 'react'

/**
 * 電視要打的短網址。
 *
 * 指向 shark7763-del/tv 這個轉址 repo，它會把使用者送到
 * .../teampro-poomsae-score/#/tv。體育館的電視只能用遙控器選字，
 * 完整網址 49 個字元實在打不動，所以走短網址。
 *
 * 轉址頁若要改，在 https://github.com/shark7763-del/tv 的 index.html。
 */
export const TV_SHORT_URL = 'shark7763-del.github.io/tv'

export function TvUrlHint(): React.ReactElement {
  const [copied, setCopied] = useState(false)

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(`https://${TV_SHORT_URL}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // 非 HTTPS 或使用者拒絕權限時沒有剪貼簿，網址本來就看得到，靜靜略過就好
    }
  }

  return (
    <div className="mb-3 rounded-lg border border-line bg-panel-2 p-3">
      <p className="text-sm font-bold text-slate-300">先在電視的瀏覽器打開這個網址：</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="select-all rounded-md bg-black/40 px-3 py-2 text-base font-black tracking-wide text-emerald-300 sm:text-lg">
          {TV_SHORT_URL}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="min-h-[40px] rounded-lg border border-line bg-panel px-3 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700"
        >
          {copied ? '已複製' : '複製'}
        </button>
      </div>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm font-bold text-slate-400">
        <li>電視打開上面的網址，畫面會出現六碼代碼</li>
        <li>把六碼輸入下方欄位，按「連接電視」</li>
      </ol>
    </div>
  )
}
