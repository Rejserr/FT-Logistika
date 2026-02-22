"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { userPreferencesApi } from "@/services/api"

interface TablePreferences {
  visibleCols: Record<string, boolean>
  columnOrder: string[]
  columnWidths: Record<string, number>
  pageSize: number
}

const SAVE_DEBOUNCE_MS = 1500

function loadLocal(storageKey: string): Partial<TablePreferences> {
  if (typeof window === "undefined") return {}
  const result: Partial<TablePreferences> = {}
  try {
    const vis = localStorage.getItem(storageKey)
    if (vis) result.visibleCols = JSON.parse(vis)
  } catch { /* ignore */ }
  try {
    const ord = localStorage.getItem(`${storageKey}-order`)
    if (ord) result.columnOrder = JSON.parse(ord)
  } catch { /* ignore */ }
  try {
    const wid = localStorage.getItem(`${storageKey}-widths`)
    if (wid) result.columnWidths = JSON.parse(wid)
  } catch { /* ignore */ }
  try {
    const ps = localStorage.getItem(`${storageKey}-pageSize`)
    if (ps) result.pageSize = JSON.parse(ps)
  } catch { /* ignore */ }
  return result
}

function saveLocal(storageKey: string, prefs: TablePreferences) {
  if (typeof window === "undefined") return
  localStorage.setItem(storageKey, JSON.stringify(prefs.visibleCols))
  localStorage.setItem(`${storageKey}-order`, JSON.stringify(prefs.columnOrder))
  localStorage.setItem(`${storageKey}-widths`, JSON.stringify(prefs.columnWidths))
  localStorage.setItem(`${storageKey}-pageSize`, JSON.stringify(prefs.pageSize))
}

export function useTablePreferences(storageKey: string | undefined, defaults: {
  visibleCols: Record<string, boolean>
  columnOrder: string[]
  pageSize: number
}) {
  const prefKey = storageKey ? `table:${storageKey}` : undefined

  const [prefs, setPrefs] = useState<TablePreferences>(() => {
    const local = storageKey ? loadLocal(storageKey) : {}
    return {
      visibleCols: local.visibleCols ?? defaults.visibleCols,
      columnOrder: local.columnOrder ?? defaults.columnOrder,
      columnWidths: local.columnWidths ?? {},
      pageSize: local.pageSize ?? defaults.pageSize,
    }
  })

  const [serverLoaded, setServerLoaded] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefsRef = useRef(prefs)
  prefsRef.current = prefs

  useEffect(() => {
    if (!prefKey) return
    let cancelled = false

    userPreferencesApi.get(prefKey)
      .then((resp) => {
        if (cancelled) return
        if (resp && resp.pref_value) {
          try {
            const server: TablePreferences = JSON.parse(resp.pref_value)
            setPrefs((prev) => ({
              visibleCols: server.visibleCols ?? prev.visibleCols,
              columnOrder: server.columnOrder ?? prev.columnOrder,
              columnWidths: server.columnWidths ?? prev.columnWidths,
              pageSize: server.pageSize ?? prev.pageSize,
            }))
            if (storageKey) saveLocal(storageKey, server)
          } catch { /* ignore malformed */ }
        }
        setServerLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setServerLoaded(true)
      })

    return () => { cancelled = true }
  }, [prefKey, storageKey])

  const persistToServer = useCallback(() => {
    if (!prefKey) return
    const data = prefsRef.current
    userPreferencesApi.set(prefKey, JSON.stringify(data)).catch(() => {})
  }, [prefKey])

  const update = useCallback((partial: Partial<TablePreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial }
      if (storageKey) saveLocal(storageKey, next)
      return next
    })

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(persistToServer, SAVE_DEBOUNCE_MS)
  }, [storageKey, persistToServer])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        persistToServer()
      }
    }
  }, [persistToServer])

  return { prefs, update, serverLoaded }
}
