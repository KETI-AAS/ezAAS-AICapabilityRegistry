"use client"

import { createContext, useContext, useMemo, useState } from "react"

type AuthUser = {
  /** The account id the user logged in with. */
  id: string
}

type AuthContextValue = {
  user: AuthUser | null
  /** Mock sign-in: accepts any non-empty id/password pair. */
  login: (id: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: (id, password) => {
        if (!id.trim() || !password.trim()) return false
        setUser({ id: id.trim() })
        return true
      },
      logout: () => setUser(null),
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
