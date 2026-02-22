"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import { userPreferencesApi } from "@/services/api"
import { useAuth } from "@/contexts/AuthContext"

const THEME_PREF_KEY = "ui:theme"

/**
 * Invisible component that syncs the user's theme preference to the server.
 * On mount: loads server preference and applies it.
 * On change: saves the new theme to the server (debounced).
 */
export function ThemeSync() {
  const { theme, setTheme } = useTheme()
  const { isAuthenticated } = useAuth()
  const initialSyncDone = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isAuthenticated || initialSyncDone.current) return
    initialSyncDone.current = true

    userPreferencesApi.get(THEME_PREF_KEY)
      .then((resp) => {
        if (resp?.pref_value) {
          setTheme(resp.pref_value)
        }
      })
      .catch(() => {})
  }, [isAuthenticated, setTheme])

  useEffect(() => {
    if (!isAuthenticated || !initialSyncDone.current || !theme) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      userPreferencesApi.set(THEME_PREF_KEY, theme).catch(() => {})
    }, 1000)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [theme, isAuthenticated])

  return null
}
