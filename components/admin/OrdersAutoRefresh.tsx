'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Pause, Play } from 'lucide-react'

/**
 * Tiny client widget that triggers a server-component refetch every N seconds
 * so the admin sees fresh status without manual refresh. Lives in a corner
 * of the orders page header. Can be paused if the admin doesn't want the
 * page jumping while they read.
 *
 * Note: this only re-fetches the LOCAL DB. The webhook keeps the DB in sync
 * with Shiprocket in near-real-time, so a 30s refetch is enough. For an
 * instant pull from Shiprocket (skipping the webhook), use SyncStatusButton.
 */
export default function OrdersAutoRefresh({ intervalSeconds = 30 }: { intervalSeconds?: number }) {
    const router = useRouter()
    const [enabled, setEnabled] = useState(true)
    const [secondsUntilNext, setSecondsUntilNext] = useState(intervalSeconds)

    useEffect(() => {
        if (!enabled) return
        const tick = setInterval(() => {
            setSecondsUntilNext((s) => {
                if (s <= 1) {
                    router.refresh()
                    return intervalSeconds
                }
                return s - 1
            })
        }, 1000)
        return () => clearInterval(tick)
    }, [enabled, intervalSeconds, router])

    return (
        <div className="flex items-center gap-2 text-xs">
            <button
                onClick={() => setEnabled((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 font-bold uppercase tracking-wider text-[10px] hover:bg-gray-50 transition-colors"
                title={enabled ? 'Pause auto-refresh' : 'Resume auto-refresh'}
            >
                {enabled ? (
                    <>
                        <RefreshCw className="w-3 h-3 text-[#d4af37] animate-spin" style={{ animationDuration: '3s' }} />
                        Auto · {secondsUntilNext}s
                    </>
                ) : (
                    <>
                        <Pause className="w-3 h-3" />
                        Paused
                    </>
                )}
            </button>
            <button
                onClick={() => {
                    router.refresh()
                    setSecondsUntilNext(intervalSeconds)
                }}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 bg-white text-gray-600 hover:text-[#8a6d18] hover:bg-[#d4af37]/10 hover:border-[#d4af37]/40 transition-all"
                title="Refresh now"
            >
                <Play className="w-3 h-3" />
            </button>
        </div>
    )
}
