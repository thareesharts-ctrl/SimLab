import { useState, useEffect } from "react"
import { useInstructorPortalStore } from "@/stores/instructorPortalStore"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Activity, TrendingUp, RefreshCw, BarChart2 } from "lucide-react"
import api from "@/lib/api"

export function InstructorAnalyticsPage() {
  const { classes, fetchClasses, selectedClassId, selectClass } = useInstructorPortalStore()
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  const loadAnalytics = async (classId: string) => {
    setLoading(true)
    try {
      const res = await api.get<{ success: boolean; analytics: any }>(`/api/instructor/classes/${classId}/analytics`)
      if (res.data?.success) {
        setAnalytics(res.data.analytics)
      }
    } catch (e) {
      console.error("Failed to load analytics", e)
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedClassId) {
      loadAnalytics(selectedClassId)
    } else if (classes.length > 0) {
      selectClass(classes[0].id)
    }
  }, [selectedClassId, classes])

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value
    selectClass(cid || null)
  }

  const channelData = analytics ? [
    { name: "SEO Optimization", score: analytics.channelPerformance?.seo || 0 },
    { name: "Paid Search", score: analytics.channelPerformance?.googleAds || 0 },
    { name: "Paid Social", score: analytics.channelPerformance?.metaAds || 0 }
  ] : []

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
        <div>
          <Badge className="bg-indigo-50 text-indigo-900 border-none uppercase text-[9px] font-black tracking-widest px-2.5 py-1 mb-2">
            Outcome Analytics
          </Badge>
          <h1 className="text-2xl md:text-3xl font-black text-neutral-900">
            Performance Analytics
          </h1>
          <p className="text-xs md:text-sm text-neutral-500 font-semibold">
            Evaluate cohort achievement distributions, channel mastery quotients, and outcome attainment matrices.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label htmlFor="analytics-class-select" className="text-xs font-bold text-neutral-600">Select Class:</label>
          <select
            id="analytics-class-select"
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

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin" />
          <span className="text-xs text-neutral-400 font-bold">Aggregating cohort analytics...</span>
        </div>
      ) : !analytics ? (
        <div className="py-12 text-center text-xs text-neutral-400 font-bold bg-white rounded-2xl border border-neutral-200">
          No analytics data available for the selected class. Let students register and start simulations.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border border-neutral-200 shadow-sm rounded-2xl bg-white p-6 flex items-center justify-between">
              <div className="space-y-2 text-left">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Class Averages</span>
                <span className="text-3xl font-black text-neutral-900">{analytics.classAverage}%</span>
                <span className="text-[10px] text-neutral-450 font-bold block">Composite score of all student runs.</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-650 shrink-0">
                <TrendingUp className="h-6 w-6" />
              </div>
            </Card>

            <Card className="border border-neutral-200 shadow-sm rounded-2xl bg-white p-6 flex items-center justify-between">
              <div className="space-y-2 text-left">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block">Median Score</span>
                <span className="text-3xl font-black text-neutral-900">{analytics.medianScore}%</span>
                <span className="text-[10px] text-neutral-450 font-bold block">Mid-point score of student runs.</span>
              </div>
              <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-650 shrink-0">
                <Activity className="h-6 w-6" />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border border-neutral-250/60 shadow-sm rounded-2xl bg-white col-span-full md:col-span-2 overflow-hidden">
              <CardHeader className="border-b border-neutral-100 pb-4">
                <CardTitle className="text-sm font-black text-neutral-900">Channel Performance Quotient</CardTitle>
                <CardDescription className="text-xs font-semibold text-neutral-500">
                  Average student scoring distributions across SEO, Google Ads, and Meta Ads channels.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={channelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="name" stroke="#6B7280" fontSize={11} fontWeight={600} tickLine={false} />
                      <YAxis stroke="#6B7280" fontSize={11} fontWeight={600} domain={[0, 100]} tickLine={false} />
                      <Tooltip cursor={{ fill: "#F3F4F6" }} />
                      <Bar dataKey="score" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-neutral-250/60 shadow-sm rounded-2xl bg-white overflow-hidden flex flex-col justify-between">
              <div>
                <CardHeader className="border-b border-neutral-100 pb-4">
                  <CardTitle className="text-sm font-black text-neutral-900">Course Outcomes (CO)</CardTitle>
                  <CardDescription className="text-xs font-semibold text-neutral-500">
                    Cohort attainment index percentages.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  {(analytics.learningOutcomes || []).map((outcome: any) => (
                    <div key={outcome.outcome} className="space-y-1.5 text-left">
                      <div className="flex justify-between text-xs font-bold text-neutral-700">
                        <span className="truncate">{outcome.outcome}</span>
                        <span className="text-indigo-650">{outcome.percentage}%</span>
                      </div>
                      <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${outcome.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
export default InstructorAnalyticsPage
