import { create } from "zustand"
import api from "@/lib/api"
import { toast } from "sonner"

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface InstructorClass {
  id: string
  name: string
  scenario: string
  studentsCount: number
  maxStudents: number
  deadline: string
  status: "active" | "draft" | "completed"
  avgScore: number
  createdAt: string
  inviteCode?: string
}

export interface InstructorScenario {
  id: string
  name: string
  description: string
  difficulty: "beginner" | "intermediate" | "advanced"
  rounds: number
  budget: number
}

export interface InstructorStudent {
  id: string
  name: string
  email: string
  classId: string
  joinedAt: string
  lastActive: string
  overallScore: number
  completionRate: number
  status: "active" | "inactive" | "pending"
  roundScores: number[]
  seoScore: number
  googleAdsScore: number
  metaAdsScore: number
  feedbackNotes: string
}

export interface InstructorAnalytics {
  totalStudents: number
  avgClassScore: number
  completionRate: number
  activeNow: number
}

export interface PendingStudent {
  id: string
  name: string
  email: string
  institution: string | null
  classId: string
  className: string
  requestedAt: string
}

interface InstructorPortalState {
  classes: InstructorClass[]
  scenarios: InstructorScenario[]
  students: InstructorStudent[]
  selectedClassId: string | null
  analytics: InstructorAnalytics
  pendingRequests: PendingStudent[]

  // Actions
  fetchClasses: () => Promise<void>
  fetchScenarios: () => Promise<void>
  fetchClassDetails: (classId: string) => Promise<void>
  createClass: (name: string, scenarioId: string, maxStudents?: number, deadline?: string) => Promise<any>
  createCustomScenario: (scenarioData: {
    name: string
    description: string
    industry: string
    startRound?: number
    maxRounds: number
    budgetPerRound: number
    baselineOrganicTraffic?: number
    targetKPI: 'revenue' | 'clicks' | 'conversions'
    difficulty: string
    allowedPlatforms?: string
  }) => Promise<any>
  archiveClass: (id: string) => Promise<any>
  deleteClass: (id: string) => Promise<any>
  inviteStudent: (classId: string, email: string) => Promise<void>
  removeStudent: (classId: string, studentId: string, reason?: string) => Promise<any>
  approveStudent: (studentId: string) => Promise<any>
  resetStudentSimulation: (studentId: string) => Promise<any>
  selectClass: (id: string | null) => void
  duplicateScenario: (id: string) => void
  updateStudentNotes: (studentId: string, notes: string) => void
  addCustomScenario: (scenario: Omit<InstructorScenario, "id">) => void
  updateClassDetails: (id: string, updates: Partial<Pick<InstructorClass, "name" | "deadline" | "maxStudents">>) => Promise<any>
  updateScenarioDetails: (id: string, data: {
    name?: string
    description?: string
    industry?: string
    maxRounds?: number
    budgetPerRound?: number
    baselineOrganicTraffic?: number
    targetKPI?: 'revenue' | 'clicks' | 'conversions'
    difficulty?: string
    allowedPlatforms?: string
  }) => Promise<any>
  fetchClassWithScenario: (classId: string) => Promise<any>
  fetchPendingRequests: () => Promise<void>
  approveJoinRequest: (classId: string, studentId: string) => Promise<void>
  rejectJoinRequest: (classId: string, studentId: string, reason?: string) => Promise<void>
}

// ─── Initial Mock Data ────────────────────────────────────────────────────────

// ─── Initial Mock Data ────────────────────────────────────────────────────────

// Removed unused INITIAL_SCENARIOS, INITIAL_CLASSES, INITIAL_STUDENTS to fix TS6133


// ─── Store Creation ──────────────────────────────────────────────────────────

export const useInstructorPortalStore = create<InstructorPortalState>((set, get) => ({
  classes: [],
  scenarios: [],
  students: [],
  pendingRequests: [],
  selectedClassId: null,
  analytics: {
    totalStudents: 0,
    avgClassScore: 0,
    completionRate: 0,
    activeNow: 0,
  },

  fetchClasses: async () => {
    try {
      const res = await api.get<{ success: boolean; classes: any[] }>('/api/v1/class')
      const rawClasses = res.data?.classes || []

      // Fetch all class details in parallel to gather real student metrics
      const detailsPromises = rawClasses.map(c =>
        api.get<{ success: boolean; class: any }>(`/api/v1/class/${c.id}`).catch(() => null)
      )
      const detailsResponses = await Promise.all(detailsPromises)

      let totalStudents = 0
      let activeNow = 0
      let sumScore = 0
      let scoredStudentsCount = 0

      const classesData = rawClasses.map((c, index) => {
        const classDetails = detailsResponses[index]?.data?.class
        const studentList = classDetails?.students || []

        studentList.forEach((s: any) => {
          totalStudents++
          const sim = s.simulations?.[0]
          if (sim) {
            // Count as active student if status is active or active within last 24h
            const lastActiveTime = sim.updatedAt ? new Date(sim.updatedAt).getTime() : 0
            const isRecent = Date.now() - lastActiveTime < 24 * 60 * 60 * 1000
            if (isRecent || s.status === 'active') {
              activeNow++
            }
            if (sim.score !== undefined) {
              sumScore += sim.score
              scoredStudentsCount++
            }
          } else if (s.status === 'active') {
            activeNow++
          }
        })

        let duration = "30 days"
        if (c.scenario?.durationDays) {
          duration = `${c.scenario.durationDays} days`
        }
        return {
          id: c.id,
          name: c.name,
          scenario: c.scenario?.name || "Startup Launch",
          studentsCount: studentList.length,
          maxStudents: 25,
          deadline: duration,
          status: (c.status || "active") as "active" | "draft" | "completed",
          avgScore: 0,
          createdAt: c.createdAt,
          inviteCode: c.inviteCode,
        }
      })

      const avgClassScore = scoredStudentsCount > 0 ? Math.round(sumScore / scoredStudentsCount) : 0

      set({
        classes: classesData,
        analytics: {
          totalStudents,
          avgClassScore,
          completionRate: 0,
          activeNow
        }
      })
    } catch (err) {
      console.error("Failed to fetch classes & analytics:", err)
    }
  },

  fetchScenarios: async () => {
    try {
      const res = await api.get<{ success: boolean; scenarios: any[] }>('/api/v1/scenario')
      const scenariosData = (res.data?.scenarios || []).map(s => ({
        id: s.id,
        name: s.name,
        description: s.description || "",
        difficulty: (s.difficulty || "medium") as "beginner" | "intermediate" | "advanced",
        rounds: s.maxRounds || 10,
        budget: s.budgetPerRound || 5000,
      }))
      set({ scenarios: scenariosData })
    } catch (err) {
      console.error("Failed to fetch scenarios:", err)
    }
  },

  fetchClassDetails: async (classId: string) => {
    try {
      const res = await api.get<{ success: boolean; class: any }>(`/api/v1/class/${classId}`)
      const cls = res.data?.class
      if (!cls) return
      
      const mappedStudents: InstructorStudent[] = (cls.students || []).map((s: any) => {
        const sim = s.simulations?.[0]
        const completionRate = sim ? Math.round(((sim.currentRound - 1) / 10) * 100) : 0
        return {
          id: s.id,
          name: s.name,
          email: s.email,
          classId: classId,
          joinedAt: s.createdAt ? s.createdAt.split('T')[0] : "Recently",
          lastActive: sim?.updatedAt ? new Date(sim.updatedAt).toLocaleDateString() : "Never",
          overallScore: sim ? sim.score : 0,
          completionRate: completionRate,
          status: s.status || "active",
          roundScores: sim ? Array.from({ length: sim.currentRound }, (_, i) => i + 1) : [1],
          seoScore: 0,
          googleAdsScore: 0,
          metaAdsScore: 0,
          feedbackNotes: "",
        }
      })

      set((state) => {
        const updatedClasses = state.classes.map((c) => {
          if (c.id === classId) {
            return {
              ...c,
              name: cls.name,
              studentsCount: mappedStudents.length,
            }
          }
          return c
        })
        return {
          students: mappedStudents,
          classes: updatedClasses,
        }
      })
    } catch (err) {
      console.error("Failed to fetch class details:", err)
    }
  },
  
  createClass: async (name, scenarioId, semester, batch, department, subject, college) => {
    try {
      const res = await api.post<{ success: boolean; class: any }>('/api/instructor/classes', {
        name,
        scenarioId,
        semester,
        batch,
        department,
        subject,
        college,
      })
      await get().fetchClasses()
      return res.data
    } catch (err) {
      console.error("Failed to create class:", err)
      throw err
    }
  },



  createCustomScenario: async (scenarioData) => {
    try {
      const res = await api.post<{ success: boolean; scenario: any }>('/api/v1/scenario', scenarioData)
      await get().fetchScenarios()
      return res.data.scenario
    } catch (err) {
      console.error("Failed to create custom scenario:", err)
      throw err
    }
  },

  archiveClass: async (id) => {
    return get().deleteClass(id)
  },

  deleteClass: async (id) => {
    try {
      const res = await api.delete<{ success: boolean }>(`/api/v1/class/${id}`)
      await get().fetchClasses()
      set({ selectedClassId: null })
      return res.data
    } catch (err) {
      console.error("Failed to delete class:", err)
      throw err
    }
  },

  inviteStudent: async (classId, email) => {
    set((state) => {
      const parts = email.split("@")[0].split(".")
      const firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "New"
      const lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "Student"
      const fullName = `${firstName} ${lastName}`

      const newStudent: InstructorStudent = {
        id: `s_new_${Date.now()}`,
        name: fullName,
        email,
        classId,
        joinedAt: new Date().toISOString().split("T")[0],
        lastActive: "Just now",
        overallScore: 0,
        completionRate: 0,
        status: "active",
        roundScores: [0],
        seoScore: 0,
        googleAdsScore: 0,
        metaAdsScore: 0,
        feedbackNotes: "",
      }

      const updatedClasses = state.classes.map((cls) => {
        if (cls.id === classId) {
          return { ...cls, studentsCount: cls.studentsCount + 1 }
        }
        return cls
      })

      return {
        students: [...state.students, newStudent],
        classes: updatedClasses,
      }
    })
  },

  removeStudent: async (classId, studentId, reason) => {
    if (studentId.startsWith("s_new_")) {
      // It's a locally invited student who is not in DB. Remove locally.
      set((state) => {
        const updatedClasses = state.classes.map((cls) => {
          if (cls.id === classId) {
            return { ...cls, studentsCount: Math.max(0, cls.studentsCount - 1) }
          }
          return cls
        })
        const updatedStudents = state.students.filter((s) => s.id !== studentId)
        return {
          students: updatedStudents,
          classes: updatedClasses,
        }
      })
      toast.success("Student removed successfully.")
      return { success: true }
    }

    try {
      const res = await api.post<{ success: boolean }>(`/api/classes/${classId}/students/${studentId}/kick`, { reason: reason || "Kicked by instructor" })
      if (classId) {
        await get().fetchClassDetails(classId)
      }
      toast.success("Student kicked successfully.")
      return res.data
    } catch (err: any) {
      console.error("Failed to remove student from class:", err)
      toast.error(err.response?.data?.error || err.message || "Failed to remove student.")
      throw err
    }
  },

  approveStudent: async (studentId) => {
    // Find classId from student
    const student = get().students.find(s => s.id === studentId);
    const classId = get().selectedClassId || student?.classId;
    if (!classId) throw new Error("No class selected");

    // Approve requires enrollmentId if matching, but wait, if we only have studentId:
    // We can fetch pending requests first, find request for this student
    await get().fetchPendingRequests();
    const req = get().pendingRequests.find(p => p.email === student?.email && p.classId === classId);
    
    if (req) {
      await api.post(`/api/classes/${classId}/enrollments/${req.id}/approve`);
    } else {
      // Fallback to legacy endpoint if no classEnrollment record found
      await api.post(`/api/v1/users/${studentId}/approve`);
    }

    if (get().selectedClassId) {
      await get().fetchClassDetails(get().selectedClassId!);
    }
    return { success: true };
  },

  resetStudentSimulation: async (studentId) => {
    try {
      const res = await api.post<{ success: boolean }>(`/api/v1/users/${studentId}/reset-simulation`)
      const classId = get().selectedClassId
      if (classId) {
        await get().fetchClassDetails(classId)
      }
      return res.data
    } catch (err) {
      console.error("Failed to reset student simulation:", err)
      throw err
    }
  },

  selectClass: (id) => {
    set({ selectedClassId: id })
  },

  duplicateScenario: (id) => {
    set((state) => {
      const scenario = state.scenarios.find((s) => s.id === id)
      if (!scenario) return {}
      const duplicated: InstructorScenario = {
        ...scenario,
        id: `sc_${state.scenarios.length + 1}`,
        name: `${scenario.name} (Copy)`,
      }
      return {
        scenarios: [...state.scenarios, duplicated],
      }
    })
  },

  updateStudentNotes: (studentId, notes) => {
    set((state) => ({
      students: state.students.map((s) => (s.id === studentId ? { ...s, feedbackNotes: notes } : s)),
    }))
  },

  addCustomScenario: (scenario) => {
    set((state) => {
      const newScenario: InstructorScenario = {
        ...scenario,
        id: `sc_${state.scenarios.length + 1}`,
      }
      return {
        scenarios: [...state.scenarios, newScenario],
      }
    })
  },

  updateClassDetails: async (id, updates) => {
    try {
      const res = await api.put<{ success: boolean; class: any }>(`/api/v1/class/${id}`, {
        name: updates.name,
      })
      await get().fetchClasses()
      if (get().selectedClassId === id) {
        await get().fetchClassDetails(id)
      }
      return res.data
    } catch (err) {
      console.error("Failed to update class details:", err)
      throw err
    }
  },

  updateScenarioDetails: async (id, data) => {
    try {
      const res = await api.put<{ success: boolean; scenario: any }>(`/api/v1/scenario/${id}`, data)
      return res.data.scenario
    } catch (err) {
      console.error("Failed to update scenario:", err)
      throw err
    }
  },

  fetchClassWithScenario: async (classId: string) => {
    try {
      const res = await api.get<{ success: boolean; class: any }>(`/api/v1/class/${classId}`)
      const cls = res.data?.class
      if (!cls) return null
      // Also fetch the full scenario details if scenarioId exists
      let scenarioFull = cls.scenario || null
      if (cls.scenarioId && (!scenarioFull || !scenarioFull.maxRounds)) {
        const scenRes = await api.get<{ success: boolean; scenario: any }>(`/api/v1/scenario/${cls.scenarioId}`).catch(() => null)
        if (scenRes?.data?.scenario) scenarioFull = scenRes.data.scenario
      }
      return { ...cls, scenarioFull }
    } catch (err) {
      console.error("Failed to fetch class with scenario:", err)
      return null
    }
  },

  fetchPendingRequests: async () => {
    try {
      const classes = get().classes
      if (classes.length === 0) return

      // Fetch pending student requests across all classes in parallel
      const results = await Promise.all(
        classes.map(c =>
          api.get<{ success: boolean; requests: any[] }>(`/api/classes/${c.id}/enrollment-requests`)
            .then(r => ({ classId: c.id, className: c.name, requests: r.data?.requests || [] }))
            .catch(() => ({ classId: c.id, className: c.name, requests: [] }))
        )
      )

      const pending: PendingStudent[] = []
      results.forEach(({ classId, className, requests }) => {
        requests.forEach((r: any) => {
          pending.push({
            id: r.id, // enrollmentId
            name: r.studentName,
            email: r.studentEmail,
            institution: null,
            classId,
            className,
            requestedAt: r.requestedAt,
          })
        })
      })

      set({ pendingRequests: pending })
    } catch (err) {
      console.error("Failed to fetch pending requests:", err)
    }
  },

  approveJoinRequest: async (classId, enrollmentId) => {
    await api.post(`/api/classes/${classId}/enrollments/${enrollmentId}/approve`)
    set(state => ({
      pendingRequests: state.pendingRequests.filter(p => p.id !== enrollmentId)
    }))
    await get().fetchClasses()
    if (get().selectedClassId === classId) {
      await get().fetchClassDetails(classId)
    }
  },

  rejectJoinRequest: async (classId, enrollmentId, reason) => {
    await api.post(`/api/classes/${classId}/enrollments/${enrollmentId}/reject`, { reason: reason || "Rejected by instructor" })
    set(state => ({
      pendingRequests: state.pendingRequests.filter(p => p.id !== enrollmentId)
    }))
    await get().fetchClasses()
    if (get().selectedClassId === classId) {
      await get().fetchClassDetails(classId)
    }
  },
}))

export default useInstructorPortalStore
