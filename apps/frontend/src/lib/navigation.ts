import { normalizeRole, getRoleRedirectPath } from './normalizeRole'

export function getSafeDashboardRoute(role?: string | null): string {
  return getRoleRedirectPath(role)
}

export function exitSandboxWorkspace(navigate: any, role?: string | null) {
  const normalized = normalizeRole(role)
  if (normalized === 'SUPER_ADMIN' || normalized === 'INDIVIDUAL') {
    navigate("/simulation", { replace: true })
  } else {
    navigate(getSafeDashboardRoute(role), { replace: true })
  }
}
