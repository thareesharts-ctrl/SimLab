import { useEffect, createElement } from "react"
import { useNavigate, Navigate } from "react-router"
import { useAuthStore } from "@/stores/authStore"
import type { UserRole } from "@/types"
import { normalizeRole } from "@/lib/normalizeRole"

/**
 * Hook to enforce role-based access control inside components.
 * Accepts canonical UserRole values (INDIVIDUAL, STUDENT_COLLEGE, INSTRUCTOR, ADMIN).
 */
export function useRoleGuard(allowedRoles: UserRole[], redirectTo: string = "/login") {
  const { user, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate(redirectTo, { replace: true })
      return
    }

    if (!allowedRoles.includes(user.role)) {
      navigate("/", { replace: true })
    }
  }, [user, isAuthenticated, allowedRoles, navigate, redirectTo])

  return {
    isAuthorized: isAuthenticated && user && allowedRoles.includes(user.role),
    user,
  }
}

interface GuardProps {
  children: React.ReactNode
  fallbackPath?: string
}

/**
 * Guard wrapper for instructor-only access.
 */
export function InstructorGuard({ children, fallbackPath = "/" }: GuardProps) {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated || !user) {
    return createElement(Navigate, { to: "/login", replace: true })
  }

  if (normalizeRole(user.role) !== "INSTRUCTOR" && normalizeRole(user.role) !== "SUPER_ADMIN") {
    return createElement(Navigate, { to: fallbackPath, replace: true })
  }

  return children as React.ReactElement
}

/**
 * Guard wrapper for student-only access (individual or college student roles).
 */
export function StudentGuard({ children, fallbackPath = "/" }: GuardProps) {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated || !user) {
    return createElement(Navigate, { to: "/login", replace: true })
  }

  const normalized = normalizeRole(user.role)
  const isStudentLike = normalized === "INDIVIDUAL" || normalized === "STUDENT"
  if (!isStudentLike) {
    return createElement(Navigate, { to: fallbackPath, replace: true })
  }

  return children as React.ReactElement
}

/**
 * Guard wrapper for admin-only access.
 */
export function AdminGuard({ children, fallbackPath = "/" }: GuardProps) {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated || !user) {
    return createElement(Navigate, { to: "/login", replace: true })
  }

  if (normalizeRole(user.role) !== "SUPER_ADMIN") {
    return createElement(Navigate, { to: fallbackPath, replace: true })
  }

  return children as React.ReactElement
}
