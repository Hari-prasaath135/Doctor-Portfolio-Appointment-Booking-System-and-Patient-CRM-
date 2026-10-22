"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}

export default function GoogleAuthButton({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const { user, loading, role, error, isSigningIn, signInWithGoogle, signOut, clearError } = useAuth()
  const router = useRouter()

  const handleSignIn = async () => {
    const signedInUser = await signInWithGoogle()
    if (signedInUser) {
      if (onLoginSuccess) {
        onLoginSuccess()
      } else {
        if (role === "DOCTOR") {
          router.push("/doctor-dashboard")
        } else if (role === "ADMIN") {
          router.push("/admin-dashboard")
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="h-10 w-28 bg-gray-100 animate-pulse rounded-xl" />
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {role === "DOCTOR" && (
          <button
            onClick={() => router.push("/doctor-dashboard")}
            className="px-3 py-1.5 text-xs font-semibold text-medical-blue bg-soft-sky/60 hover:bg-soft-sky rounded-lg transition-colors cursor-pointer"
          >
            Doctor Portal
          </button>
        )}
        {role === "ADMIN" && (
          <button
            onClick={() => router.push("/admin-dashboard")}
            className="px-3 py-1.5 text-xs font-semibold text-medical-blue bg-soft-sky/60 hover:bg-soft-sky rounded-lg transition-colors cursor-pointer"
          >
            Admin Portal
          </button>
        )}
        {user.photoURL && (
          <Image
            src={user.photoURL}
            alt={user.displayName ?? "User"}
            width={32}
            height={32}
            className="rounded-full ring-2 ring-medical-blue/20"
          />
        )}
        <span className="text-xs font-semibold text-deep-trust hidden xl:inline">
          {user.displayName?.split(" ")[0]}
        </span>
        <button
          onClick={signOut}
          className="px-3.5 py-1.5 text-xs font-semibold text-text-secondary hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 cursor-pointer"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-deep-trust bg-white hover:bg-gray-50 border border-gray-200 rounded-xl shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-60"
      >
        {isSigningIn ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-medical-blue" />
            Signing in...
          </>
        ) : (
          <>
            <GoogleLogo />
            Sign in with Google
          </>
        )}
      </button>

      {error && (
        <div
          onClick={clearError}
          className="absolute right-0 top-12 z-50 w-64 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-tight shadow-lg cursor-pointer"
          title="Click to dismiss"
        >
          {error}
        </div>
      )}
    </div>
  )
}