import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"
import { useInstructorPortalStore } from "@/stores/instructorPortalStore"
import { normalizeRole } from "@/lib/normalizeRole"
import {
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Clock,
  RefreshCw,
  Compass
} from "lucide-react"

interface MarketEvent {
  id: string
  simulationId: string
  round: number
  name: string
  description: string
  type: string // ALGORITHM_UPDATE, SEASONAL_SPIKE, COMPETITOR_PRICE_DROP, etc.
  impactMultiplier: number
  createdAt: string
}

export function MarketEventsPage() {
  const { user } = useAuthStore()
  const { classes, selectedClassId, selectClass, fetchClasses } = useInstructorPortalStore()
  const [events, setEvents] = useState<MarketEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backendMessage, setBackendMessage] = useState<string | null>(null)

  const isInstructor = normalizeRole(user?.role) === "INSTRUCTOR" || normalizeRole(user?.role) === "SUPER_ADMIN"

  const fetchEvents = async () => {
    if (isInstructor && !selectedClassId) {
      setEvents([])
      setBackendMessage("Please select a class to view market events.")
      return
    }

    setLoading(true)
    setError(null)
    setBackendMessage(null)
    try {
      const params = isInstructor ? { classId: selectedClassId } : {}
      const res = await api.get<{ success: boolean; events: MarketEvent[]; message?: string }>("/api/v1/events", { params })
      if (res.data?.success) {
        setEvents(res.data.events)
        if (res.data.message) {
          setBackendMessage(res.data.message)
        }
      }
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.error || "Failed to load market events history.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isInstructor) {
      fetchClasses().then(() => {
        fetchEvents()
      })
    } else {
      fetchEvents()
    }
  }, [selectedClassId, isInstructor])

  // Helper to get styling based on event type
  const getEventBadge = (type: string) => {
    const t = type.toUpperCase()
    if (t.includes("ALGORITHM")) {
      return <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200">Algorithm Update</Badge>
    }
    if (t.includes("SEASONAL") || t.includes("SPIKE")) {
      return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">Seasonal Spike</Badge>
    }
    return <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200">Competitor Incident</Badge>
  }

  // Get adaptation advice based on event type
  const getAdaptationAdvice = (type: string, impact: number) => {
    const t = type.toUpperCase()
    if (t.includes("ALGORITHM")) {
      return "Algorithm tweaks compress default organic impressions. To adapt, optimize keyword densities inside your SEO metadata, and increase paid CPC bid ceilings to capture missing lead volumes."
    }
    if (t.includes("SEASONAL") || t.includes("SPIKE")) {
      return `Demand multiplier expanded by ${((impact - 1) * 105).toFixed(0)}%. Capitalize on higher search intents by raising Google Ads budgets and scaling Meta placement reach to Instagram feeds.`
    }
    return "Competitor price reductions reduce conversion readiness. Adapt by highlighting product USP differentiators in your Meta creative texts and increasing offer clarity on your landing page."
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-950 p-6 md:p-8 text-white shadow-lg text-left">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
              <span className="text-xs font-extrabold uppercase tracking-widest text-amber-300">Market Intelligence Feed</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Market Events Timeline</h1>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-xl font-medium leading-relaxed">
              Track algorithm changes, seasonal waves, and competitive threats injected into your simulation round. Adapt campaigns to maintain scaling metrics.
            </p>
          </div>
          <Button
            onClick={fetchEvents}
            disabled={loading}
            className="bg-white hover:bg-neutral-100 text-neutral-900 text-xs font-black h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow shrink-0 self-start md:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh Timeline
          </Button>
        </div>
      </div>

      {/* Class Selector Dropdown for Instructors */}
      {isInstructor && (
        <div className="flex justify-start items-center gap-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm text-left">
          <span className="text-xs font-bold text-neutral-600">Active Classroom Cohort:</span>
          <select
            value={selectedClassId || ""}
            onChange={(e) => selectClass(e.target.value || null)}
            className="p-2 border border-neutral-300 rounded-lg text-xs font-semibold bg-white max-w-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">-- Select a Classroom --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 2. Main content timeline */}
      <div className="space-y-6">
        
        {loading && events.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin" />
            <p className="text-xs font-semibold text-neutral-455">Retrieving simulation events timeline...</p>
          </div>
        ) : error ? (
          <Card className="border-rose-200 bg-rose-50 text-rose-700 p-6 text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5.5 w-5.5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-black uppercase tracking-wider">Failed to load events</h4>
                <p className="text-xs font-medium leading-relaxed text-rose-600">{error}</p>
                <p className="text-[11px] text-rose-500 pt-1 font-semibold">Make sure you have an active simulation session running in your dashboard.</p>
              </div>
            </div>
          </Card>
        ) : isInstructor && !selectedClassId ? (
          <Card className="border-2 border-dashed border-neutral-200 rounded-2xl p-12 text-center bg-neutral-50/20">
            <Calendar className="h-10 w-10 text-neutral-300 mx-auto" />
            <h3 className="font-extrabold text-sm text-neutral-800 mt-3">Select a Class to View Market Events</h3>
            <p className="text-xs text-neutral-450 font-semibold max-w-xs mx-auto mt-1 leading-relaxed">
              Please choose an active class cohort from the dropdown above to audit historical market event logs.
            </p>
          </Card>
        ) : events.length === 0 ? (
          <Card className="border-2 border-dashed border-neutral-200 rounded-2xl p-12 text-center bg-neutral-50/20">
            <Calendar className="h-10 w-10 text-neutral-300 mx-auto" />
            <h3 className="font-extrabold text-sm text-neutral-800 mt-3">
              {backendMessage || "No Market Incident Logs"}
            </h3>
            <p className="text-xs text-neutral-450 font-semibold max-w-xs mx-auto mt-1 leading-relaxed">
              No market events have been injected for the current round. Advancing rounds will trigger random search and social fluctuations.
            </p>
          </Card>
        ) : (
          <div className="relative border-l-2 border-indigo-100 pl-6 ml-4 space-y-8 text-left">
            {events.map((event) => {
              const isBoost = event.impactMultiplier >= 1.0
              return (
                <div key={event.id} className="relative space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Timeline dot */}
                  <div className="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-indigo-600 bg-white z-10 shadow-sm" />
                  
                  <Card className="border-neutral-200 shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden">
                    <CardHeader className="pb-3 border-b border-neutral-50 bg-neutral-50/20">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {getEventBadge(event.type)}
                            <Badge className="bg-neutral-900 text-white text-[9px] font-bold">Round {event.round}</Badge>
                          </div>
                          <CardTitle className="text-base font-black text-neutral-900 pt-1">{event.name}</CardTitle>
                        </div>
                        
                        {/* Impact Multiplier Badge */}
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${
                          isBoost 
                             ? "bg-emerald-50 text-emerald-700 border-emerald-150" 
                             : "bg-rose-50 text-rose-700 border-rose-150"
                        }`}>
                          {isBoost ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          <span>{event.impactMultiplier.toFixed(2)}x Impact</span>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-5 space-y-4">
                      {/* Description */}
                      <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
                        {event.description}
                      </p>
                      
                      {/* Recommendation adaptation block */}
                      <div className="p-4 border border-indigo-105 bg-indigo-50/15 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-indigo-550" />
                          Recommended Adaptation Action
                        </span>
                        <p className="text-xs text-neutral-600 font-semibold leading-relaxed">
                          {getAdaptationAdvice(event.type, event.impactMultiplier)}
                        </p>
                      </div>
                      
                      <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400 font-medium">
                        <span>Incident Hash: {event.id.substring(0, 8).toUpperCase()}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Logged {new Date(event.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

export default MarketEventsPage
