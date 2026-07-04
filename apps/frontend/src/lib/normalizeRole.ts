/**
 * normalizeRole — canonical role normalization helper.
 *
 * The backend stores roles as uppercase strings in the DB:
 *   ADMIN, INSTRUCTOR, STUDENT_COLLEGE, INDIVIDUAL
 *
 * This helper accepts any casing variant (legacy lowercase, hyphenated, etc.)
 * and returns a single canonical NormalizedRole value used throughout the
 * frontend for route guards, sidebar visibility, and API access checks.
 *
 * Usage:
 *   import { normalizeRole } from '@/lib/normalizeRole'
 *   const role = normalizeRole(user?.role) // → 'INDIVIDUAL' | 'STUDENT' | etc.
 */

export type NormalizedRole = 'SUPER_ADMIN' | 'INSTRUCTOR' | 'STUDENT' | 'INDIVIDUAL';

export function normalizeRole(role?: string | null): NormalizedRole | null {
  if (!role) return null;

  // Normalize to upper_snake_case
  const r = role.toUpperCase().replace(/-/g, '_');

  if (r === 'ADMIN' || r === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (r === 'INSTRUCTOR') return 'INSTRUCTOR';
  if (r === 'STUDENT' || r === 'STUDENT_COLLEGE') return 'STUDENT';
  if (r === 'INDIVIDUAL' || r === 'LEARNER') return 'INDIVIDUAL';

  return null;
}

/** Returns true if the role is allowed to access personal sandbox APIs */
export function canAccessSandbox(role?: string | null): boolean {
  const n = normalizeRole(role);
  return n === 'INDIVIDUAL' || n === 'SUPER_ADMIN';
}

/** Returns true if the role is a classroom-based student */
export function isStudentRole(role?: string | null): boolean {
  return normalizeRole(role) === 'STUDENT';
}

/** Returns true if the role is an instructor */
export function isInstructorRole(role?: string | null): boolean {
  return normalizeRole(role) === 'INSTRUCTOR';
}

/** Returns true if the role is a super admin / admin */
export function isAdminRole(role?: string | null): boolean {
  return normalizeRole(role) === 'SUPER_ADMIN';
}

/** Returns the correct post-login redirect path for a given role */
export function getRoleRedirectPath(role?: string | null): string {
  const n = normalizeRole(role);
  if (n === 'SUPER_ADMIN') return '/admin';
  if (n === 'INSTRUCTOR') return '/instructor';
  // STUDENT and INDIVIDUAL both go to /dashboard
  return '/dashboard';
}
