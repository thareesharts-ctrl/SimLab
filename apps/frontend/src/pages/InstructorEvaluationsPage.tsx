import { useState, useEffect } from "react"
import { useInstructorPortalStore } from "@/stores/instructorPortalStore"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CheckCircle, Clock, Award, FileText, Send, HelpCircle, RefreshCw } from "lucide-react"
import api from "@/lib/api"

export function InstructorEvaluationsPage() {
  const { classes, fetchClasses, selectedClassId, selectClass, students, fetchClassDetails } = useInstructorPortalStore()
  
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [studentReport, setStudentReport] = useState<any>(null)
  
  // Evaluation Form States
  const [comment, setComment] = useState("")
  const [score, setScore] = useState(80)
  const [approved, setApproved] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [certApproving, setCertApproving] = useState(false)

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  useEffect(() => {
    if (selectedClassId) {
      fetchClassDetails(selectedClassId)
      setStudentReport(null)
      setSelectedStudentId(null)
    } else if (classes.length > 0) {
      selectClass(classes[0].id)
    }
  }, [selectedClassId, classes])

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    selectClass(e.target.value || null)
  }

  const handleSelectStudent = async (studentId: string) => {
    setSelectedStudentId(studentId)
    setLoadingReport(true)
    try {
      const res = await api.get<{ success: boolean; report: any }>(`/api/instructor/students/${studentId}/report`)
      if (res.data?.success) {
        setStudentReport(res.data.report)
        // Pre-fill checkpoint comments or values if they exist
        setComment("")
        setScore(80)
        setApproved(true)
      }
    } catch (err) {
      console.error("Failed to load student report", err)
      setStudentReport(null)
    } finally {
      setLoadingReport(false)
    }
  }

  const handleSubmitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId || !selectedClassId) return

    setSubmitting(true)
    try {
      const res = await api.post<{ success: boolean; message: string }>("/api/instructor/evaluations", {
        studentId: selectedStudentId,
        classId: selectedClassId,
        comment,
        score,
        approved
      })
      if (res.data?.success) {
        toast.success("Evaluation and feedback submitted successfully!")
        // Refresh report
        await handleSelectStudent(selectedStudentId)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit evaluation.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleApproveCertificate = async () => {
    if (!selectedStudentId) return
    setCertApproving(true)
    try {
      const res = await api.post<{ success: boolean; message: string }>(`/api/instructor/certificates/${selectedStudentId}/approve`)
      if (res.data?.success) {
        toast.success("Student certificate approved and issued successfully!")
        await handleSelectStudent(selectedStudentId)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to approve certificate.")
    } finally {
      setCertApproving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
        <div>
          <Badge className="bg-indigo-50 text-indigo-900 border-none uppercase text-[9px] font-black tracking-widest px-2.5 py-1 mb-2">
            Evaluation Hub
          </Badge>
          <h1 className="text-2xl md:text-3xl font-black text-neutral-900">
            Student Evaluations &amp; Checkpoints
          </h1>
          <p className="text-xs md:text-sm text-neutral-500 font-semibold">
            Evaluate checkpoint justifications, add feedback remarks, issue grades, and approve achievement certificates.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label htmlFor="eval-class-select" className="text-xs font-bold text-neutral-600">Select Class:</label>
          <select
            id="eval-class-select"
            value={selectedClassId || ""}
            onChange={handleClassChange}
            className="h-10 px-3 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold"
          >
            <option value="">-- Choose Class --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: Student list */}
        <Card className="border border-neutral-250/60 shadow-sm rounded-2xl bg-white overflow-hidden text-left h-fit">
          <CardHeader className="border-b border-neutral-100 pb-4">
            <CardTitle className="text-sm font-black text-neutral-900">Class Cohort Students</CardTitle>
            <CardDescription className="text-xs font-semibold text-neutral-500">
              Select a student to check progress, reflections, and metrics.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 max-h-[500px] overflow-y-auto divide-y divide-neutral-150/40">
            {students.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400 font-bold">
                No students enrolled in this class.
              </div>
            ) : (
              students.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelectStudent(s.id)}
                  className={`w-full p-4 text-left transition-colors flex items-center justify-between ${
                    selectedStudentId === s.id ? "bg-indigo-50/60" : "hover:bg-neutral-50/40"
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-neutral-800 block">{s.name}</span>
                    <span className="text-[10px] text-neutral-400 font-semibold block">{s.email}</span>
                  </div>
                  <Badge className="bg-neutral-100 text-neutral-600 border-none font-bold text-[9px] px-2 py-0.5 shrink-0 ml-2">
                    Round {s.currentRound}
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right column: Evaluation detail view */}
        <div className="col-span-1 md:col-span-2 text-left space-y-6">
          {loadingReport ? (
            <Card className="border border-neutral-250/60 shadow-sm rounded-2xl bg-white py-16 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin" />
              <span className="text-xs text-neutral-400 font-bold">Retrieving student dossier...</span>
            </Card>
          ) : !studentReport ? (
            <Card className="border border-neutral-250/60 shadow-sm rounded-2xl bg-white p-12 text-center flex flex-col items-center justify-center gap-3">
              <HelpCircle className="h-10 w-10 text-neutral-350" />
              <span className="text-xs text-neutral-400 font-black">No Student Selected</span>
              <p className="text-[11px] text-neutral-500 font-semibold max-w-xs mx-auto">
                Please select a student from the sidebar list to view their justifications and execute evaluations.
              </p>
            </Card>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card className="border border-neutral-250/60 shadow-sm rounded-2xl bg-white p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-neutral-100 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-neutral-900">{studentReport.studentName}</h3>
                    <span className="text-xs text-neutral-400 font-semibold block mt-0.5">{studentReport.studentEmail}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-neutral-100 text-neutral-600 border-none font-bold text-[9px] px-2.5 py-1">
                      Current Score: {studentReport.score}%
                    </Badge>
                    <Badge className="bg-neutral-100 text-neutral-600 border-none font-bold text-[9px] px-2.5 py-1">
                      Status: {studentReport.isCompleted ? "Completed" : "Active"}
                    </Badge>
                  </div>
                </div>

                {/* Justification details */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    Latest Round Justification (Round {studentReport.currentRound})
                  </span>
                  <div className="bg-neutral-50 p-4 border border-neutral-200/80 rounded-xl">
                    <p className="text-xs text-neutral-600 font-semibold leading-relaxed whitespace-pre-wrap">
                      {studentReport.progress?.justificationText || 
                       "No checkpoint justifications submitted by the student for the current round."}
                    </p>
                  </div>
                </div>

                {/* Feedback Form */}
                <form onSubmit={handleSubmitEvaluation} className="space-y-4 pt-4 border-t border-neutral-100">
                  <span className="text-xs font-black text-neutral-800 block">Grade Validation &amp; Commentary</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="eval-score" className="text-[11px] font-bold text-neutral-500">Reflection Quality Score (%)</label>
                      <input
                        id="eval-score"
                        type="number"
                        min="0"
                        max="100"
                        value={score}
                        onChange={e => setScore(parseInt(e.target.value) || 0)}
                        className="w-full h-10 px-3 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="eval-status" className="text-[11px] font-bold text-neutral-500">Checkpoint Status</label>
                      <select
                        id="eval-status"
                        value={approved ? "true" : "false"}
                        onChange={e => setApproved(e.target.value === "true")}
                        className="w-full h-10 px-3 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold bg-white"
                      >
                        <option value="true">Approve Checkpoint</option>
                        <option value="false">Request Revision / Reject</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="eval-comment" className="text-[11px] font-bold text-neutral-500">Instructor Feedback Comment</label>
                    <textarea
                      id="eval-comment"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Add strategic guidelines or remarks for the student..."
                      className="w-full min-h-[90px] p-3 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl px-4 text-xs h-9 flex items-center gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {submitting ? "Saving..." : "Save Evaluation"}
                  </Button>
                </form>
              </Card>

              {/* Certificate issues card */}
              <Card className="border border-neutral-250/60 shadow-sm rounded-2xl bg-white p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-neutral-900 flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-indigo-600" />
                      Achievement Certification Gating
                    </h4>
                    <p className="text-[11px] text-neutral-500 font-semibold">
                      Certificates will be issued once the simulation completes, provided the instructor approves.
                    </p>
                  </div>
                  <Button
                    onClick={handleApproveCertificate}
                    disabled={certApproving}
                    className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl px-4 text-xs h-9"
                  >
                    {certApproving ? "Approving..." : "Approve & Issue Certificate"}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default InstructorEvaluationsPage
