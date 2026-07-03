import { useState, useEffect } from "react"
import { useInstructorPortalStore } from "@/stores/instructorPortalStore"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Users, RefreshCw } from "lucide-react"
import api from "@/lib/api"

export function InstructorLeaderboardPage() {
  const { classes, fetchClasses, selectedClassId, selectClass } = useInstructorPortalStore()
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  const loadLeaderboard = async (classId: string) => {
    setLoading(true)
    try {
      const res = await api.get<{ success: boolean; leaderboard: any[] }>(`/api/instructor/classes/${classId}/leaderboard`)
      if (res.data?.success) {
        setLeaderboard(res.data.leaderboard || [])
      }
    } catch (e) {
      console.error("Failed to load leaderboard", e)
      setLeaderboard([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedClassId) {
      loadLeaderboard(selectedClassId)
    } else if (classes.length > 0) {
      selectClass(classes[0].id)
    }
  }, [selectedClassId, classes])

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value
    selectClass(cid || null)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
        <div>
          <Badge className="bg-indigo-50 text-indigo-900 border-none uppercase text-[9px] font-black tracking-widest px-2.5 py-1 mb-2">
            Class Standings
          </Badge>
          <h1 className="text-2xl md:text-3xl font-black text-neutral-900">
            Simulation Leaderboard
          </h1>
          <p className="text-xs md:text-sm text-neutral-500 font-semibold">
            Track student performance rank-by-rank based on their advertising efficiency, ROI metrics, and overall scores.
          </p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          <label htmlFor="leaderboard-class-select" className="text-xs font-bold text-neutral-600">Select Class:</label>
          <select
            id="leaderboard-class-select"
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

      <Card className="border border-neutral-250/60 shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardHeader className="border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <div>
              <CardTitle className="text-md font-black text-neutral-900">Cohort Standings</CardTitle>
              <CardDescription className="text-xs font-semibold text-neutral-500">
                Real-time scoring standings based on round-by-round optimization indices.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin" />
              <span className="text-xs text-neutral-400 font-bold">Querying cohort leaderboard...</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-400 font-bold">
              No simulation runs found for the selected class. Let students register and start simulations to build leaderboard standings.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-100 text-neutral-500 font-black uppercase text-[10px] tracking-wider">
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">Current Round</th>
                    <th className="px-6 py-4">Cumulative Spend</th>
                    <th className="px-6 py-4">Cumulative Revenue</th>
                    <th className="px-6 py-4 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium text-neutral-600">
                  {leaderboard.map((item, idx) => {
                    const isTop3 = idx < 3
                    const rankColors = [
                      "bg-amber-100 text-amber-800",
                      "bg-slate-100 text-slate-700",
                      "bg-orange-100 text-orange-800"
                    ]
                    return (
                      <tr key={item.studentEmail} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-neutral-900">
                          {isTop3 ? (
                            <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-black ${rankColors[idx]}`}>
                              {idx + 1}
                            </span>
                          ) : (
                            idx + 1
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-neutral-900">{item.studentName}</div>
                          <div className="text-[10px] text-neutral-400 font-medium mt-0.5">{item.studentEmail}</div>
                        </td>
                        <td className="px-6 py-4">Round {item.currentRound}</td>
                        <td className="px-6 py-4">${item.cumulativeSpend.toLocaleString()}</td>
                        <td className="px-6 py-4">${item.cumulativeRevenue.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-black text-indigo-650 text-sm">
                          {item.score}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
export default InstructorLeaderboardPage
