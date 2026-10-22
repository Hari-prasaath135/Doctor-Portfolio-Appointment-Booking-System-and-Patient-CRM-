"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import GoogleAuthButton from "@/components/layout/GoogleAuthButton"
import { ShieldAlert, Lock, ArrowLeft, Loader2, Home } from "lucide-react"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: string[]
  dashboardName: string
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  dashboardName,
}: ProtectedRouteProps) {
  const { user, loading, role, signOut } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 1. Initial hydration and auth resolving loading state
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-soft-sky/20 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-soft-sky text-medical-blue rounded-2xl flex items-center justify-center mx-auto mb-4 animate-spin">
            <Loader2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-heading font-bold text-deep-trust mb-2">
            Verifying Access
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Authenticating your credentials and verifying {dashboardName.toLowerCase()} authorization...
          </p>
        </div>
      </div>
    )
  }

  // 2. Unauthenticated: Prompt to sign in with authorized credentials
  if (!user) {
    return (
      <div className="min-h-screen bg-soft-sky/20 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-deep-trust mb-2">
            Authentication Required
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-6">
            The <strong className="text-deep-trust">{dashboardName}</strong> is restricted to authorized personnel. Please sign in with your verified clinic account.
          </p>

          <div className="flex justify-center mb-6">
            <GoogleAuthButton />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-medical-blue transition-colors font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Clinic Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 3. Authenticated but Unauthorized Role (e.g. PATIENT attempting admin dashboard or doctor attempting admin dashboard)
  const isAuthorized = role && allowedRoles.includes(role)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-soft-sky/20 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl border border-red-100 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-deep-trust mb-2">
            Access Denied (403)
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            Your account (<strong className="text-deep-trust">{user.email}</strong>) is verified with role{" "}
            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-deep-trust font-semibold text-xs uppercase tracking-wider">
              {role || "PATIENT"}
            </span>
            , which does not have permission to access the {dashboardName}.
          </p>

          <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3.5 mb-6 text-left text-xs text-amber-900 leading-normal">
            Only authorized accounts configured with{" "}
            <strong>{allowedRoles.join(" or ")}</strong> privileges can access this area.
          </div>

          <div className="flex flex-col gap-2.5">
            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-medical-blue hover:bg-medical-blue-hover text-white rounded-xl text-sm font-semibold shadow-md transition-all"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-text-secondary text-sm font-medium rounded-xl transition-colors cursor-pointer"
            >
              Sign out & Switch Account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 4. Fully Authenticated and Authorized
  return <>{children}</>
}
