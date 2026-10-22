"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth"
import { auth } from "@/lib/firebase-client"

export interface AuthContextType {
  user: User | null
  loading: boolean
  role: string | null
  error: string | null
  isSigningIn: boolean
  signInWithGoogle: () => Promise<{ user: User | null; role: string | null }>
  signOut: () => Promise<void>
  clearError: () => void
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: null,
  error: null,
  isSigningIn: false,
  signInWithGoogle: async () => ({ user: null, role: null }),
  signOut: async () => {},
  clearError: () => {},
  getIdToken: async () => null,
})

const API_BASE_URL = "http://localhost:5000/api/v1"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)

  // Listen to centralized Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken()
          const res = await fetch(`${API_BASE_URL}/auth/verify`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          })
          if (res.ok) {
            const json = await res.json()
            const verifiedRole = json?.data?.role || "PATIENT"
            setRole(verifiedRole)
            // Force refresh ID token so new custom claims minted on server are available in client token
            await firebaseUser.getIdToken(true).catch(() => {})
          } else {
            setRole("PATIENT")
          }
        } catch {
          setRole("PATIENT")
        }
      } else {
        setRole(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const clearError = () => setError(null)

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    if (!auth.currentUser) return null
    try {
      return await auth.currentUser.getIdToken(forceRefresh)
    } catch {
      return null
    }
  }

  const signInWithGoogle = async (): Promise<{ user: User | null; role: string | null }> => {
    if (isSigningIn) return { user: null, role: null }
    setIsSigningIn(true)
    setError(null)

    try {
      const provider = new GoogleAuthProvider()
      // Enforce prompt account selection
      provider.setCustomParameters({ prompt: "select_account" })

      const result = await signInWithPopup(auth, provider)
      const signedInUser = result.user
      setUser(signedInUser)

      let authoritativeRole = "PATIENT"
      const idToken = await signedInUser.getIdToken()
      try {
        const res = await fetch(`${API_BASE_URL}/auth/verify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        })
        if (res.ok) {
          const json = await res.json()
          authoritativeRole = json?.data?.role || "PATIENT"
          setRole(authoritativeRole)
          // Force refresh ID token to get the updated custom claims into the JWT
          await signedInUser.getIdToken(true).catch(() => {})
        } else {
          setRole("PATIENT")
        }
      } catch {
        setRole("PATIENT")
      }

      return { user: signedInUser, role: authoritativeRole }
    } catch (err: any) {
      const errorCode = err?.code

      switch (errorCode) {
        case "auth/popup-closed-by-user":
          // User voluntarily closed the window; do not display error overlay or harsh message
          setError("Sign-in cancelled. Please try again when ready.")
          break

        case "auth/cancelled-popup-request":
          // Handled silently
          break

        case "auth/popup-blocked":
          setError("Sign-in popup was blocked by your browser. Please allow popups for this site and retry.")
          break

        case "auth/network-request-failed":
          setError("Network connection issue. Please check your internet connection and try again.")
          break

        case "auth/unauthorized-domain":
          setError("This domain is not authorized in the Firebase console for OAuth. Please contact the clinic administrator.")
          break

        default:
          setError(err?.message || "An unexpected error occurred during Google sign-in. Please try again.")
          break
      }

      return { user: null, role: null }
    } finally {
      setIsSigningIn(false)
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
      setUser(null)
      setRole(null)
      setError(null)
    } catch (err: any) {
      setError("Failed to sign out. Please try again.")
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        role,
        error,
        isSigningIn,
        signInWithGoogle,
        signOut,
        clearError,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
