export enum UserRole {
  ADMIN = 'ADMIN',
  INSTRUCTOR = 'INSTRUCTOR',
  STUDENT_COLLEGE = 'STUDENT_COLLEGE',
  INDIVIDUAL = 'INDIVIDUAL'
}

export function normalizeRole(role?: string | null): UserRole {
  if (!role) return UserRole.STUDENT_COLLEGE;
  const r = role.toUpperCase().replace(/-/g, '_');
  if (r === 'ADMIN' || r === 'SUPER_ADMIN') return UserRole.ADMIN;
  if (r === 'INSTRUCTOR' || r === 'FACULTY' || r === 'TEACHER') return UserRole.INSTRUCTOR;
  if (r === 'STUDENT' || r === 'STUDENT_COLLEGE') return UserRole.STUDENT_COLLEGE;
  if (r === 'INDIVIDUAL' || r === 'LEARNER') return UserRole.INDIVIDUAL;
  return UserRole.STUDENT_COLLEGE;
}

export function isInstructor(role: string): boolean {
  const norm = normalizeRole(role);
  return norm === UserRole.INSTRUCTOR || norm === UserRole.ADMIN;
}

export function isAdmin(role: string): boolean {
  const norm = normalizeRole(role);
  return norm === UserRole.ADMIN;
}

export function isValidRole(role: string): role is UserRole {
  try {
    const norm = normalizeRole(role);
    return Object.values(UserRole).includes(norm);
  } catch {
    return false;
  }
}
