import { useState, useEffect } from "react"
import { useAuthStore } from "@/stores/authStore"
import { normalizeRole } from "@/lib/normalizeRole"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import api from "@/lib/api"
import { useNavigate, Link } from "react-router"
import {
  Sparkles,
  Activity,
  LogOut,
  Clock,
  Shield,
  Lock,
  CheckCircle,
  ArrowUpRight,
  Plus,
  ArrowRight,
  Award,
  BookOpen,
  AlertTriangle,
  Users
} from "lucide-react"

export function DashboardPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [simulationLoading, setSimulationLoading] = useState(false)
  const [activeSimulation, setActiveSimulation] = useState<any>(null)

  // Conditional data states
  const [subscription, setSubscription] = useState<any>(null)
  const [eligibility, setEligibility] = useState<any>(null)
  const [bestRoi, setBestRoi] = useState<number>(0)
  const [hasScore, setHasScore] = useState<boolean>(false)
  const [scoringError, setScoringError] = useState<boolean>(false)
  const [activeAssignment, setActiveAssignment] = useState<any>(null)
  const [classStandings, setClassStandings] = useState<any>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)

  // Redirect instructor and admin users immediately to their respective dashboards
  useEffect(() => {
    const normalized = normalizeRole(user?.role)
    if (normalized === "INSTRUCTOR") {
      navigate("/instructor", { replace: true })
    } else if (normalized === "SUPER_ADMIN") {
      navigate("/admin", { replace: true })
    }
  }, [user, navigate])

  // Fetch role-specific details
  const fetchDashboardData = async () => {
    if (!user) return
    setDashboardLoading(true)
    try {
      // Active simulation is shared
      const simRes = await api.get("/api/simulations")
      if (simRes.data && simRes.data.length > 0) {
        setActiveSimulation(simRes.data[0])
      }

      if (normalizeRole(user.role) === "INDIVIDUAL") {
        // Fetch subscription
        const subRes = await api.get("/api/v1/billing/subscription").catch(() => null)
        if (subRes && subRes.data?.success) {
          setSubscription(subRes.data.subscription)
        }

        // Fetch eligibility checklist
        const eligRes = await api.post("/api/certificates/check-eligibility").catch(() => null)
        if (eligRes && eligRes.data?.success) {
          setEligibility(eligRes.data)
        }

        // Fetch score breakdown for best ROI
        setScoringError(false)
        try {
          const bRes = await api.get("/api/v1/scoring/breakdown")
          if (bRes && bRes.data?.success) {
            setHasScore(!!bRes.data.hasScore)
            if (bRes.data.breakdowns?.length > 0) {
              const rois = bRes.data.breakdowns.map((b: any) => b.efficiencyRoi || 0)
              setBestRoi(Math.max(...rois, 0))
            }
          } else {
            setHasScore(false)
          }
        } catch (err: any) {
          if (!err.response) {
            setScoringError(true)
          }
          setHasScore(false)
        }
      } else if (normalizeRole(user.role) === "STUDENT") {
        // Fetch active assignment
        const assignRes = await api.get("/api/v1/assignments/student/active").catch(() => null)
        if (assignRes && assignRes.data?.success) {
          setActiveAssignment(assignRes.data.activeAssignment)
        }

        // Fetch class standings
        const lbRes = await api.get("/api/v1/scoring/leaderboard").catch(() => null)
        if (lbRes && lbRes.data?.success) {
          setClassStandings(lbRes.data)
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard statistics:", err)
    } finally {
      setDashboardLoading(false)
    }
  }

  useEffect(() => {
    const normalized = normalizeRole(user?.role)
    if (normalized === "STUDENT" || normalized === "INDIVIDUAL") {
      fetchDashboardData()
    }
  }, [user])

  const handleStartSimulation = async () => {
    setSimulationLoading(true)
    try {
      const response = await api.post("/api/simulations")
      setActiveSimulation(response.data)
      toast.success("New digital marketing simulation session initialized!")
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to initialize simulation session.")
    } finally {
      setSimulationLoading(false)
    }
  };

  // Render Role Badge
  const getRoleBadge = (role: string) => {
    const normalized = normalizeRole(role)
    switch (normalized) {
      case "SUPER_ADMIN":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-1 px-2.5">System Admin</Badge>
      case "INSTRUCTOR":
        return <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1 px-2.5">Course Instructor</Badge>
      case "STUDENT":
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1 px-2.5">Academic Student</Badge>
      default:
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-1 px-2.5">Individual Plan</Badge>
    }
  }

  // Compute remaining days
  const remainingDays = subscription?.endDate
    ? Math.max(0, Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 3600 * 24)))
    : 0

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* 1. HEADER WELCOME AREA */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-950 p-6 md:p-8 text-white shadow-lg">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 -mb-20 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 text-left">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
              <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-300">SimLab Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
              Welcome back, {user?.name || "Marketing Specialist"}!
            </h1>
            <p className="text-sm md:text-base text-neutral-300 max-w-xl font-medium leading-relaxed">
              Manage your active sessions, monitor campaign algorithms, and track your marketing conversions.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {getRoleBadge(user?.role || "individual")}
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="bg-transparent border-neutral-700 text-neutral-300 hover:bg-white/10 hover:text-white font-bold h-9"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {dashboardLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Activity className="h-10 w-10 text-indigo-600 animate-spin" />
          <p className="text-sm font-semibold text-neutral-400">Loading your learning workspace data...</p>
        </div>
      ) : (
        <>
          {/* ======================================================
              INDIVIDUAL LEARNER MODE VIEW
             ====================================================== */}
          {normalizeRole(user?.role) === "INDIVIDUAL" && (
            <div className="space-y-8">
              
              {/* Top Row: Sub status, Limits, and CTA */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Subscription Countdown */}
                <Card className="border border-neutral-200/80 shadow-md bg-white p-6 flex flex-col justify-between text-left">
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-neutral-450 tracking-wider flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-indigo-500" />
                      Plan Status
                    </span>
                    <h3 className="text-lg font-black text-neutral-900 capitalize">
                      {subscription?.plan?.name || "Free Trial Account"}
                    </h3>
                    
                    {subscription ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-neutral-600 pt-1">
                          <span>Remaining Days</span>
                          <span className="text-indigo-600">{remainingDays} Days</span>
                        </div>
                        <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden border border-neutral-200/50">
                          <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, (remainingDays / 30) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-neutral-400 font-semibold block">Ends on {new Date(subscription.endDate).toLocaleDateString()}</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-neutral-600 pt-1">
                          <span>Sandbox Access</span>
                          <span className="text-amber-600">Temporary</span>
                        </div>
                        <span className="text-[10px] text-neutral-450 font-semibold block">Upgrade below to secure permanent workspace credentials.</span>
                      </div>
                    )}
                  </div>
                  <Link to="/subscription" className="mt-4">
                    <Button variant="outline" className="w-full text-xs font-black h-9 border-neutral-250 text-neutral-700 hover:bg-neutral-50 rounded-lg">
                      Manage Subscription
                    </Button>
                  </Link>
                </Card>

                {/* Plan Access Limitations */}
                <Card className="border border-neutral-200/80 shadow-md bg-white p-6 flex flex-col justify-between text-left col-span-1">
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-neutral-450 tracking-wider flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-emerald-500" />
                      Simulator Parameters
                    </span>
                    <h3 className="text-lg font-black text-neutral-900">Sandbox Limits</h3>
                    
                    <div className="space-y-2 text-xs font-bold text-neutral-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>SEO Indexing: <span className="text-neutral-900 font-black">Unlimited</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Google Search CPC: <span className="text-neutral-950">₹5,000 /rd cap</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-neutral-400 font-medium">
                        <Lock className="h-3.5 w-3.5 text-neutral-300 shrink-0" />
                        <span>Export PDF Reports: <span className="text-neutral-500 font-bold">Pro plan only</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-neutral-400 font-semibold mt-3">
                    Bidding resets daily. Simulator runs locally on local DB.
                  </div>
                </Card>

                {/* Upgrade Subscription CTA */}
                <Card className="relative overflow-hidden border border-indigo-950/20 bg-gradient-to-br from-indigo-905 via-neutral-900 to-indigo-950 p-6 flex flex-col justify-between text-white text-left shadow-lg">
                  <div className="absolute right-0 top-0 -mt-8 -mr-8 h-24 w-24 rounded-full bg-indigo-500/10 blur-xl" />
                  <div className="space-y-2.5 relative z-10">
                    <span className="text-[9px] font-black uppercase text-indigo-300 tracking-widest bg-indigo-900/50 border border-indigo-700/50 px-2 py-0.5 rounded-md w-max block">
                      Scale Strategy
                    </span>
                    <h3 className="text-lg font-extrabold tracking-tight">Upgrade to Premium Pro</h3>
                    <p className="text-xs text-neutral-300 font-semibold leading-relaxed">
                      Unlock unlimited PDF export certificates, advanced LLM insights, and higher daily CPC ceilings.
                    </p>
                  </div>
                  
                  <Link to="/pricing" className="mt-4 relative z-10">
                    <Button className="w-full bg-white hover:bg-neutral-50 text-indigo-950 font-black text-xs h-9 rounded-xl flex items-center justify-center gap-1.5 shadow">
                      Upgrade My Account
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </Card>

              </div>

              {/* Middle Row: Simulation Launchpad and Certificate Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Simulation Control Card */}
                <Card className="border border-neutral-200/80 shadow-md p-6 space-y-6 text-left md:col-span-2 flex flex-col justify-between bg-white">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />
                      <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Digital Simulator Console</span>
                    </div>
                    <h3 className="font-extrabold text-lg text-neutral-900">Active Simulation Session</h3>
                    <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
                      Set budget allocations, coordinate SEO keywords, index structural landing page descriptions, and establish bid triggers for Google and Meta Ads.
                    </p>
                  </div>

                  {activeSimulation ? (
                    scoringError ? (
                      <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 text-center py-4 mt-4 space-y-2">
                        <p className="text-xs text-red-700 font-bold">Failed to load scores due to network error.</p>
                        <Button
                          onClick={fetchDashboardData}
                          variant="outline"
                          size="sm"
                          className="h-8 text-[10px] font-black border-red-200 text-red-700 bg-white hover:bg-red-50"
                        >
                          Retry Connection
                        </Button>
                      </div>
                    ) : !hasScore ? (
                      <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/70 text-center py-5 mt-4">
                        <p className="text-xs text-neutral-500 font-bold">
                          No score yet. Start a sandbox simulation to generate your first score.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-neutral-205 bg-neutral-50 space-y-3 mt-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400 font-bold">SIMULATION SESSION</span>
                          <Badge className="bg-indigo-600 text-white text-[9px] font-bold">INITIALIZED</Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-4 pt-1">
                          <div>
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Round</span>
                            <span className="text-sm font-extrabold text-neutral-900 block mt-0.5">Round {activeSimulation.currentRound || 1}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Score</span>
                            <span className="text-sm font-extrabold text-neutral-900 block mt-0.5">{(activeSimulation.score || 0).toFixed(1)}%</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Best ROI Score</span>
                            <span className="text-sm font-extrabold text-indigo-650 block mt-0.5">{bestRoi > 0 ? `${bestRoi.toFixed(1)}%` : "N/A"}</span>
                          </div>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-center py-6 mt-4">
                      <p className="text-xs text-neutral-400 font-bold">No active simulation session initialized.</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-6 border-t border-neutral-100">
                    <Button
                      onClick={handleStartSimulation}
                      disabled={simulationLoading}
                      className="flex-1 bg-slate-900 text-white hover:bg-slate-950 font-black text-xs h-10 rounded-xl"
                    >
                      {simulationLoading ? "Initializing..." : activeSimulation ? "Restart Sandbox Simulation" : "Launch Simulator"}
                      {!simulationLoading && <Plus className="ml-1.5 h-4 w-4" />}
                    </Button>
                    {activeSimulation && (
                      <Link to="/simulation" className="flex-1">
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-10 rounded-xl flex items-center justify-center gap-1">
                          Enter Simulation Lab
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </Card>

                {/* Certificate Checklist Card */}
                <Card className="border border-neutral-200/80 shadow-md p-6 space-y-4 text-left flex flex-col justify-between bg-white">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-base text-neutral-900 flex items-center gap-1.5">
                        <Award className="h-4.5 w-4.5 text-indigo-600 animate-bounce" />
                        Certificate Checklist
                      </h3>
                      <Badge className="bg-indigo-50 text-indigo-700 border-none font-bold text-[9px]">Individual</Badge>
                    </div>
                    
                    <div className="space-y-3.5 pt-2">
                      <div className="flex items-start gap-3">
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black ${eligibility?.compositeScore >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}>
                          {eligibility?.compositeScore >= 70 ? "✔" : "1"}
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block leading-none">Composite Score</span>
                          <span className="text-xs font-bold text-neutral-850 block mt-1">
                            {eligibility?.compositeScore ? `${eligibility.compositeScore.toFixed(1)}%` : "0%"} (Min 70% required)
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black ${eligibility?.strategicConsistency >= 65 ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}>
                          {eligibility?.strategicConsistency >= 65 ? "✔" : "2"}
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block leading-none">Consistency Index</span>
                          <span className="text-xs font-bold text-neutral-850 block mt-1">
                            {eligibility?.strategicConsistency ? `${eligibility.strategicConsistency.toFixed(1)}%` : "0%"} (Min 65% required)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black ${activeSimulation?.status === 'SCORE_LOCKED' || activeSimulation?.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}>
                          {(activeSimulation?.status === 'SCORE_LOCKED' || activeSimulation?.status === 'COMPLETED') ? "✔" : "3"}
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wide block leading-none">Status Code</span>
                          <span className="text-xs font-bold text-neutral-850 block mt-1 uppercase">
                            {activeSimulation?.status || "None"} (Requires Completed Rounds)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Link to="/certificate" className="pt-4">
                    <Button variant="outline" className="w-full text-xs font-black border-neutral-250 text-neutral-700 h-9 rounded-lg">
                      Open Certificate Portal
                    </Button>
                  </Link>
                </Card>

              </div>

            </div>
          )}

          {/* ======================================================
              COLLEGE STUDENT MODE VIEW
             ====================================================== */}
          {normalizeRole(user?.role) === "STUDENT" && (
            <div className="space-y-8">
              
              {/* Top Row: Scenario Briefing, Countdown, and Standing Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Active Assignment Briefing */}
                <Card className="border border-neutral-200/80 shadow-md bg-white p-6 flex flex-col justify-between text-left md:col-span-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-neutral-450 tracking-wider flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4 text-emerald-500 animate-pulse" />
                        Academic Course Assignment
                      </span>
                      <Badge className="bg-emerald-50 text-emerald-700 border-none font-extrabold text-[9px] uppercase">
                        {activeAssignment?.assignment?.difficulty || "Medium"} Difficulty
                      </Badge>
                    </div>
                    
                    {activeAssignment ? (
                      <div className="space-y-2">
                        <h3 className="text-lg font-black text-neutral-900 leading-snug">
                          {activeAssignment.assignment.assignmentName}
                        </h3>
                        <p className="text-xs text-neutral-400 font-semibold">
                          Scenario Target: <span className="text-neutral-800 font-extrabold">{activeAssignment.assignment.scenario?.name}</span>
                        </p>
                        <p className="text-xs text-neutral-500 font-medium leading-relaxed bg-neutral-50/70 p-3 rounded-lg border border-neutral-100">
                          {activeAssignment.assignment.scenario?.description}
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4 pt-2 text-xs font-semibold text-neutral-600">
                          <div>
                            <span className="text-[9px] text-neutral-400 uppercase font-black tracking-wider block">Target Metric KPI</span>
                            <span className="text-neutral-850 font-bold block mt-0.5 capitalize">{activeAssignment.assignment.scenario?.targetKPI || "Revenue"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-neutral-400 uppercase font-black tracking-wider block">Round Budget Cap</span>
                            <span className="text-neutral-850 font-bold block mt-0.5">₹{(activeAssignment.assignment.dailyBudgetCap || 5000).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-neutral-400 font-semibold space-y-1">
                        <AlertTriangle className="h-6 w-6 text-neutral-300 mx-auto" />
                        <p>No active classroom assignment has been started yet.</p>
                        <p className="text-[10px] text-neutral-450 font-normal">Check back once your instructor has published an assignment.</p>
                      </div>
                    )}
                  </div>

                  {activeAssignment && (
                    <Link to="/simulation/briefing" className="mt-4">
                      <Button variant="outline" className="w-full text-xs font-black border-neutral-250 text-neutral-700 h-9 rounded-lg">
                        Read Full Scenario Briefing
                      </Button>
                    </Link>
                  )}
                </Card>

                {/* Assignment Countdown Card */}
                <Card className="border border-neutral-200/80 shadow-md bg-white p-6 flex flex-col justify-between text-left">
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-neutral-450 tracking-wider flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-indigo-500 animate-spin" />
                      Round Timeline
                    </span>
                    <h3 className="text-lg font-black text-neutral-900">Assignment Remaining</h3>
                    
                    {activeAssignment?.assignment?.endDate ? (() => {
                      const end = new Date(activeAssignment.assignment.endDate)
                      const diffDays = Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 3600 * 24)))
                      return (
                        <div className="space-y-3.5 pt-1.5">
                          <div className="text-center bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5">
                            <span className="text-3xl font-black text-indigo-650 block leading-none">{diffDays}</span>
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mt-1.5">Days Left</span>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-semibold block text-center">
                            Submission Lock: {end.toLocaleDateString()} at {activeAssignment.assignment.dailyProcessingTime || "09:00"}
                          </span>
                        </div>
                      )
                    })() : (
                      <div className="py-6 text-center text-neutral-400 font-semibold">
                        N/A (No active rounds)
                      </div>
                    )}
                  </div>
                  
                  <Link to="/campaign/timeline">
                    <Button variant="outline" className="w-full text-xs font-black border-neutral-250 text-neutral-700 h-9 rounded-lg">
                      View Decisions Timeline
                    </Button>
                  </Link>
                </Card>

              </div>

              {/* Middle Row: Benchmark comparison and Active Simulation Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Cohort Benchmarking standings */}
                {(!activeSimulation?.classId || normalizeRole(user?.role) === "INDIVIDUAL") ? null : (
                  <Card className="border border-neutral-200/80 shadow-md p-6 space-y-6 text-left md:col-span-2 flex flex-col justify-between bg-white">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-neutral-450 tracking-wider flex items-center gap-1.5">
                          <Users className="h-4.5 w-4.5 text-indigo-550" />
                          Classroom Benchmark comparison
                        </span>
                        <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold text-[9px]">Class Standing</Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div className="p-3 border border-neutral-100 rounded-xl bg-neutral-50/50">
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wide">My Standing</span>
                          <span className="block text-2xl font-black text-neutral-900 mt-1">
                            {classStandings?.classRank ? `Rank #${classStandings.classRank}` : "Rank #N/A"}
                          </span>
                        </div>
                        
                        <div className="p-3 border border-neutral-100 rounded-xl bg-neutral-50/50">
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wide">My Score</span>
                          <span className="block text-2xl font-black text-indigo-650 mt-1">
                            {activeSimulation?.score ? `${activeSimulation.score.toFixed(1)}%` : "0.0%"}
                          </span>
                        </div>

                        <div className="p-3 border border-neutral-100 rounded-xl bg-neutral-50/50">
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wide">Class Avg Score</span>
                          <span className="block text-2xl font-black text-neutral-900 mt-1">
                            {classStandings?.classStats?.averageScore ? `${classStandings.classStats.averageScore}%` : "0.0%"}
                          </span>
                        </div>
                      </div>

                      {/* Progress Benchmark slider visual */}
                      {activeSimulation?.score !== undefined && classStandings?.classStats?.averageScore !== undefined && (
                        <div className="space-y-2 pt-2 border-t border-neutral-100 text-xs">
                          <div className="flex justify-between font-bold text-neutral-600">
                            <span>My Score vs. Class Average Benchmark</span>
                            <span className={activeSimulation.score >= classStandings.classStats.averageScore ? "text-emerald-600" : "text-amber-600"}>
                              {activeSimulation.score >= classStandings.classStats.averageScore
                                ? `+${(activeSimulation.score - classStandings.classStats.averageScore).toFixed(1)}% Above Class Average`
                                : `${(activeSimulation.score - classStandings.classStats.averageScore).toFixed(1)}% Below Class Average`}
                            </span>
                          </div>
                          <div className="relative h-2 w-full bg-neutral-100 rounded-full border border-neutral-200/50">
                            {/* Class average marker */}
                            <div 
                              className="absolute top-0 bottom-0 w-1 bg-neutral-400 z-10" 
                              style={{ left: `${classStandings.classStats.averageScore}%` }}
                              title="Class Average"
                            />
                            {/* Student score fill */}
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                activeSimulation.score >= classStandings.classStats.averageScore ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${activeSimulation.score}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Link to="/leaderboard" className="pt-2">
                      <Button className="w-full bg-slate-900 hover:bg-slate-950 text-white font-black text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 shadow-sm">
                        Open Student Leaderboard
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </Card>
                )}

                {/* Academic Simulation Actions */}
                <Card className={`border border-neutral-200/80 shadow-md p-6 space-y-4 text-left flex flex-col justify-between bg-white ${(!activeSimulation?.classId || normalizeRole(user?.role) === "INDIVIDUAL") ? "md:col-span-3" : ""}`}>
                  <div className="space-y-3.5">
                    <h3 className="font-extrabold text-base text-neutral-900">Campaign Console</h3>
                    <p className="text-xs text-neutral-400 font-semibold leading-relaxed">
                      Launch your active daily search bidding campaigns and organic keyword optimizations.
                    </p>

                    <div className="p-3.5 bg-neutral-50 border border-neutral-150 rounded-xl space-y-2">
                      <div className="flex justify-between text-xs font-semibold text-neutral-500">
                        <span>Campaign Days</span>
                        <span className="text-neutral-900 font-bold">
                          Day {activeAssignment?.campaignRun?.currentDay || 1} of {activeAssignment?.campaignRun?.durationDays || 30}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-neutral-500">
                        <span>Status</span>
                        <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold text-[9px] uppercase">
                          {activeAssignment?.campaignRun?.status || "Initialized"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Link to="/campaign">
                    <Button className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs h-10 rounded-xl flex items-center justify-center gap-1">
                      Enter Daily Campaign Run
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </Card>

              </div>

            </div>
          )}
        </>
      )}

    </div>
  )
}

export default DashboardPage
