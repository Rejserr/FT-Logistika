"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { userPreferencesApi } from "@/services/api"

const SAVE_DEBOUNCE_MS = 1000

/**
 * Persists a single preference value to the server (with localStorage as fast cache).
 * Works like useState but syncs to server per user.
 */
export function useServerPref<T>(
  prefKey: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const serverKey = `ui:${prefKey}`

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue
    try {
      const saved = localStorage.getItem(serverKey)
      if (saved != null) return JSON.parse(saved)
    } catch { /* ignore */ }
    return defaultValue
  })

  const valueRef = useRef(value)
  valueRef.current = value
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    userPreferencesApi.get(serverKey)
      .then((resp) => {
        if (cancelled || !resp?.pref_value) return
        try {
          const parsed = JSON.parse(resp.pref_value) as T
          setValue(parsed)
          localStorage.setItem(serverKey, JSON.stringify(parsed))
        } catch { /* ignore */ }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [serverKey])

  const persistToServer = useCallback(() => {
    userPreferencesApi.set(serverKey, JSON.stringify(valueRef.current)).catch(() => {})
  }, [serverKey])

  const update = useCallback((updater: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof updater === "function" ? (updater as (prev: T) => T)(prev) : updater
      localStorage.setItem(serverKey, JSON.stringify(next))
      return next
    })
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(persistToServer, SAVE_DEBOUNCE_MS)
  }, [serverKey, persistToServer])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        persistToServer()
      }
    }
  }, [persistToServer])

  return [value, update]
}
