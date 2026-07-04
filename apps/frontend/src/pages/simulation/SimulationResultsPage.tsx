import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router"
import { useSimulationStore } from "@/stores/simulationStore"
import { useResultsStore } from "@/stores/resultsStore"
import { useAuthStore } from "@/stores/authStore"
import { normalizeRole } from "@/lib/normalizeRole"
import { Button } from "@/components/ui/button"
import { Card, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  ArrowLeft, ArrowRight, Award, RefreshCw, TrendingUp, TrendingDown,
  Search, Target, Coins, Zap, Trophy,
  Download, Printer, Eye, Sparkles, Clock, Users,
  CheckCircle
} from "lucide-react"
import api from "@/lib/api"
import { SimulationProgressTracker } from "@/components/simulation/SimulationProgressTracker"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts"

export function SimulationResultsPage() {
  const { activeSimulation, fetchLatestState, isLoading, loadingMessage } = useSimulationStore()
  const { 
    fetchResults, currentRound, overallScore, channelScores, 
    insights, classRank, totalStudents,
    breakdowns, snapshots, leaderboard, events, allMetrics
  } = useResultsStore()

  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [activeChartTab, setActiveChartTab] = useState<"revenue" | "traffic" | "conversion" | "ctr" | "authority" | "ranking">("revenue")
  const [checkpointSubmitted, setCheckpointSubmitted] = useState(true)

  const allowed = activeSimulation?.allowedPlatforms || ["SEO", "GOOGLE_ADS", "META_ADS"]

  const getFirstStrategyPath = () => {
    if (allowed.includes("SEO")) return "/simulation/seo"
    if (allowed.includes("GOOGLE_ADS")) return "/simulation/google-ads"
    return "/simulation/meta-ads"
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const state = await fetchLatestState()
      if (state?.id) {
        await fetchResults(state.id)
        
        // Check checkpoint submission
        const isCollegeStudent = normalizeRole(user?.role) === "STUDENT"
        if (isCollegeStudent && state.currentRound > 1) {
          try {
            const checkRes = await api.get<{ success: boolean; checkpoints: any[] }>(`/api/v1/simulation/checkpoint/${state.id}`)
            if (checkRes.data?.success) {
              const hasPrevCheckpoint = checkRes.data.checkpoints.some(
                (cp: any) => cp.roundNumber === state.currentRound - 1
              )
              setCheckpointSubmitted(hasPrevCheckpoint)
            } else {
              setCheckpointSubmitted(false)
            }
          } catch (e) {
            console.error("Failed to fetch checkpoints", e)
            setCheckpointSubmitted(false)
          }
        } else {
          setCheckpointSubmitted(true)
        }
      }
    } catch (err) {
      console.error("Failed to load results:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // If the socket completed round and state updated, reload results
  useEffect(() => {
    if (activeSimulation && !isLoading && !loading) {
      fetchResults(activeSimulation.id)
    }
  }, [activeSimulation?.currentRound, isLoading])

  // handleAdvance is unused since submissions are handled on the last strategy page.

  // ─── Mathematical Aggregations ──────────────────────────────────────────────

  const aggregateMetrics = (roundMetrics: any[]) => {
    let organicImpressions = 0, organicClicks = 0, organicConversions = 0
    let googleImpressions = 0, googleClicks = 0, googleConversions = 0, googleSpend = 0
    let metaImpressions = 0, metaClicks = 0, metaConversions = 0, metaSpend = 0
    let revenue = 0

    roundMetrics.forEach((m) => {
      organicImpressions += m.organicImpressions || 0
      organicClicks += m.organicClicks || 0
      organicConversions += m.organicConversions || 0

      googleImpressions += m.googleImpressions || 0
      googleClicks += m.googleClicks || 0
      googleConversions += m.googleConversions || 0
      googleSpend += m.googleCost || 0

      metaImpressions += m.metaImpressions || 0
      metaClicks += m.metaClicks || 0
      metaConversions += m.metaConversions || 0
      metaSpend += m.metaCost || 0

      revenue += m.revenue || 0
    })

    const totalClicks = organicClicks + googleClicks + metaClicks
    const totalImpressions = organicImpressions + googleImpressions + metaImpressions
    const totalConversions = organicConversions + googleConversions + metaConversions
    const totalSpend = googleSpend + metaSpend

    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const cpc = (googleClicks + metaClicks) > 0 ? totalSpend / (googleClicks + metaClicks) : 0
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0
    const roas = totalSpend > 0 ? revenue / totalSpend : 0

    return {
      revenue,
      clicks: totalClicks,
      impressions: totalImpressions,
      conversions: totalConversions,
      spend: totalSpend,
      ctr,
      cpc,
      cpa,
      roas,
      organicImpressions,
      organicClicks,
      organicConversions,
      googleImpressions,
      googleClicks,
      googleConversions,
      googleSpend,
      metaImpressions,
      metaClicks,
      metaConversions,
      metaSpend
    }
  }

  // Current round aggregates (round indexes in db match currentRound - 1)
  const currentRoundMetrics = allMetrics.filter((m) => m.round === currentRound - 1)
  const currAgg = aggregateMetrics(currentRoundMetrics)

  // Previous round aggregates
  const prevRoundMetrics = allMetrics.filter((m) => m.round === currentRound - 2)
  const prevAgg = aggregateMetrics(prevRoundMetrics)

  // Calculate SEO Authority growth
  const getDAForRound = (r: number) => {
    const roundSnaps = snapshots.filter((s) => s.round <= r)
    const cumulativeBacklinkSpend = roundSnaps.reduce((sum, s) => sum + (s.data.seoDecisions?.backlinkBudget || 0), 0)
    return Math.min(100, Math.round(15 + (cumulativeBacklinkSpend > 0 ? Math.log10(cumulativeBacklinkSpend + 1) * 12 : 0)))
  }
  const getPAForRound = (r: number, da: number) => {
    const snap = snapshots.find((s) => s.round === r)
    const contentQuality = snap?.data.seoDecisions?.contentQuality || 5.0
    return Math.min(100, Math.round(contentQuality * 7 + da * 0.3))
  }

  const currentDA = getDAForRound(currentRound - 1)
  const currentPA = getPAForRound(currentRound - 1, currentDA)

  const prevDA = getDAForRound(currentRound - 2)
  const prevPA = getPAForRound(currentRound - 2, prevDA)

  // Average keyword rankings
  const getAvgKeywordRank = (seoScoreValue: number, keywords: string[]) => {
    const positions = keywords.map((kw, index) => {
      const seed = kw.length + index
      return Math.max(1, Math.round((100 - seoScoreValue) / 5 + (seed % 5)))
    })
    return positions.length > 0 ? positions.reduce((sum, p) => sum + p, 0) / positions.length : 100
  }

  const currentSeoScore = channelScores.seo.score
  const currentKeywords = snapshots.find((s) => s.round === currentRound - 1)?.data.seoDecisions?.keywords || []
  const currentAvgRank = getAvgKeywordRank(currentSeoScore, currentKeywords)

  const prevSeoScore = channelScores.seo.previous
  const prevKeywords = snapshots.find((s) => s.round === currentRound - 2)?.data.seoDecisions?.keywords || []
  const prevAvgRank = getAvgKeywordRank(prevSeoScore, prevKeywords)

  // Helper to compute growth
  const getGrowth = (current: number, previous: number, lowerIsBetter: boolean = false) => {
    if (previous === 0) return { pct: 0, text: "N/A", trend: "neutral" as const }
    const diff = current - previous
    const pct = parseFloat(((diff / previous) * 100).toFixed(1))
    const trend = diff === 0 ? ("neutral" as const) : (diff > 0 ? (lowerIsBetter ? ("down" as const) : ("up" as const)) : (lowerIsBetter ? ("up" as const) : ("down" as const)))
    const prefix = diff > 0 ? "+" : ""
    return { pct, text: `${prefix}${pct}%`, trend }
  }

  // 12 Analytics KPI cards mapping
  const kpis = [
    {
      label: "Revenue",
      value: `$${currAgg.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      prevText: `$${prevAgg.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      growth: getGrowth(currAgg.revenue, prevAgg.revenue),
      icon: Coins,
      color: "text-emerald-500"
    },
    {
      label: "Traffic",
      value: currAgg.clicks.toLocaleString(),
      prevText: prevAgg.clicks.toLocaleString(),
      growth: getGrowth(currAgg.clicks, prevAgg.clicks),
      icon: Users,
      color: "text-indigo-500"
    },
    {
      label: "Impressions",
      value: currAgg.impressions.toLocaleString(),
      prevText: prevAgg.impressions.toLocaleString(),
      growth: getGrowth(currAgg.impressions, prevAgg.impressions),
      icon: Eye,
      color: "text-blue-500"
    },
    {
      label: "Ad Clicks",
      value: (currAgg.googleClicks + currAgg.metaClicks).toLocaleString(),
      prevText: (prevAgg.googleClicks + prevAgg.metaClicks).toLocaleString(),
      growth: getGrowth(currAgg.googleClicks + currAgg.metaClicks, prevAgg.googleClicks + prevAgg.metaClicks),
      icon: Zap,
      color: "text-amber-500"
    },
    {
      label: "CTR",
      value: `${currAgg.ctr.toFixed(2)}%`,
      prevText: `${prevAgg.ctr.toFixed(2)}%`,
      growth: getGrowth(currAgg.ctr, prevAgg.ctr),
      icon: TrendingUp,
      color: "text-sky-500"
    },
    {
      label: "CPC",
      value: `$${currAgg.cpc.toFixed(2)}`,
      prevText: `$${prevAgg.cpc.toFixed(2)}`,
      growth: getGrowth(currAgg.cpc, prevAgg.cpc, true),
      icon: Target,
      color: "text-rose-500"
    },
    {
      label: "CPA",
      value: `$${currAgg.cpa.toFixed(2)}`,
      prevText: `$${prevAgg.cpa.toFixed(2)}`,
      growth: getGrowth(currAgg.cpa, prevAgg.cpa, true),
      icon: Award,
      color: "text-orange-500"
    },
    {
      label: "ROAS",
      value: `${currAgg.roas.toFixed(2)}x`,
      prevText: `${prevAgg.roas.toFixed(2)}x`,
      growth: getGrowth(currAgg.roas, prevAgg.roas),
      icon: Trophy,
      color: "text-violet-500"
    },
    {
      label: "Conversions",
      value: currAgg.conversions.toString(),
      prevText: prevAgg.conversions.toString(),
      growth: getGrowth(currAgg.conversions, prevAgg.conversions),
      icon: CheckCircle,
      color: "text-teal-500"
    },
    {
      label: "Authority Score",
      value: `PA: ${currentPA}`,
      prevText: `PA: ${prevPA}`,
      growth: getGrowth(currentPA, prevPA),
      icon: Sparkles,
      color: "text-purple-500",
      extra: `DA: ${currentDA}`
    },
    {
      label: "Ranking Position",
      value: `#${currentAvgRank.toFixed(1)}`,
      prevText: `#${prevAvgRank.toFixed(1)}`,
      growth: getGrowth(currentAvgRank, prevAvgRank, true),
      icon: Search,
      color: "text-pink-500"
    },
    {
      label: "Lead Generation",
      value: `${currAgg.conversions} Leads`,
      prevText: `${prevAgg.conversions} Leads`,
      growth: getGrowth(currAgg.conversions, prevAgg.conversions),
      icon: Target,
      color: "text-cyan-500"
    }
  ]

  const filteredKpis = kpis.filter((kpi) => {
    const label = kpi.label;
    if (label === "Authority Score" || label === "Ranking Position") {
      return allowed.includes("SEO");
    }
    if (["Ad Clicks", "CTR", "CPC", "CPA", "ROAS", "Lead Generation"].includes(label)) {
      return allowed.includes("GOOGLE_ADS") || allowed.includes("META_ADS");
    }
    return true;
  });

  // Strategic alignment breakdowns
  const latestBreakdown = breakdowns.find((b) => b.round === currentRound - 1)
  const strategicScores = [
    { label: "Strategic Alignment", score: Math.round(latestBreakdown?.strategicAlignment || 0), description: "Sync of targeting parameters and platform selections" },
    { label: "ROI Efficiency", score: Math.round(latestBreakdown?.efficiencyRoi || 0), description: "Return on ad spend and budget deployment margin" },
    { label: "Risk Management", score: Math.round(latestBreakdown?.riskManagement || 0), description: "Creative fatigue containment and bidding discipline" },
    { label: "Adaptability", score: Math.round(latestBreakdown?.adaptability || 0), description: "Response to triggered seasonal changes or market events" },
    { label: "Strategic Consistency", score: Math.round(latestBreakdown?.strategicConsistency || 0), description: "Long-term keywords pacing and bidding stability" }
  ]

  // Multi-round chart dataset mapping
  const chartData = snapshots.map((s) => {
    const roundMetrics = s.data.dailyMetrics || []
    const aggregated = aggregateMetrics(roundMetrics)
    const da = getDAForRound(s.round)
    const pa = getPAForRound(s.round, da)
    const scores = s.data.scores || {}
    const kwList = s.data.seoDecisions?.keywords || []
    const avgRank = getAvgKeywordRank(scores.seo || 0, kwList)

    return {
      roundName: `Round ${s.round}`,
      revenue: aggregated.revenue,
      traffic: aggregated.clicks,
      conversions: aggregated.conversions,
      ctr: parseFloat(aggregated.ctr.toFixed(2)),
      domainAuthority: da,
      pageAuthority: pa,
      averageRank: parseFloat(avgRank.toFixed(1))
    }
  })

  // Benchmarks comparison
  const classScoresSum = leaderboard.reduce((sum, item) => sum + (item.score || 0), 0)
  const classAverage = Math.round(classScoresSum / (leaderboard.length || 1))
  const topPerformerScore = leaderboard.length > 0 ? Math.round(leaderboard[0].score) : 100
  const performanceGap = topPerformerScore - overallScore
  const recommendedTarget = Math.min(100, Math.round(topPerformerScore * 1.05))

  // AI Advice structure
  const wellText = currentSeoScore >= 70 || currAgg.roas >= 1.8 || (latestBreakdown?.efficiencyRoi || 0) >= 75
    ? "Your strategic setup yielded efficient ROAS, backed by consistent search keywords authority indexing."
    : "Conversions remain steady. Focus on tightening ad bid pacing for better ROI efficiency."

  const wrongText = currentSeoScore < 50 || currAgg.ctr < 2.0 || (latestBreakdown?.riskManagement || 0) < 55
    ? "Low Organic crawl visibility is restricting free visits. Ad CTR indicates potential copywriting misalignment."
    : "Review Meta Ad creative fatigue indices and adjust bidding constraints to prevent over-budgeting."

  // ─── Exports Handlers ────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "Round,SEO Score,Google Ads Score,Meta Ads Score,Overall Score,Revenue,Traffic,Impressions,Conversions,Spend,ROAS,Avg Keyword Rank\n"
    
    snapshots.forEach((s) => {
      const roundMetrics = s.data.dailyMetrics || []
      const aggregated = aggregateMetrics(roundMetrics)
      const scores = s.data.scores || {}
      const kwList = s.data.seoDecisions?.keywords || []
      const avgRank = getAvgKeywordRank(scores.seo || 0, kwList)
      
      csvContent += `Round ${s.round},${Math.round(scores.seo || 0)},${Math.round(scores.google || 0)},${Math.round(scores.meta || 0)},${Math.round(scores.composite || 0)},${aggregated.revenue},${aggregated.clicks},${aggregated.impressions},${aggregated.conversions},${aggregated.spend},${aggregated.roas.toFixed(2)},${avgRank.toFixed(1)}\n`
    })
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `simlab_results_simulation_${activeSimulation?.id || 'report'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrintPDF = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin" />
        <span className="text-sm text-neutral-500 font-bold">Retrieving round reports...</span>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 text-center p-6 max-w-md mx-auto">
        <div className="relative">
          <div className="h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <Zap className="h-6 w-6 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-neutral-900">
            {loadingMessage || "Simulating Auctions..."}
          </h2>
          <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
            Please wait while the simulation engine executes search indexing, paid social auctions, and processes cumulative scoring math.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Dynamic Style Block for Printable Reports */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 10pt;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:col-span-full {
            grid-column: span 12 / span 12 !important;
          }
          .print\\:border-none {
            border: none !important;
            box-shadow: none !important;
          }
          .print\\:w-full {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Navigation Progress Tracker */}
      <div className="print:hidden">
        <SimulationProgressTracker />
      </div>

      {/* Header Summary Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left border-b border-neutral-100 pb-5">
        <div className="space-y-1">
          <Link to="/simulation" className="print:hidden inline-flex items-center gap-1 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Simulation Console
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 flex items-center gap-2">
            <Award className="h-7 w-7 text-indigo-600" />
            Simulation Analysis Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 font-semibold">
            Cohort Analytics Report for <span className="text-neutral-800 font-bold">Round {currentRound - 1 || 1}</span>
          </p>
        </div>
        
        {/* Next Round CTA / Monitoring Badge */}
        <div className="flex items-center gap-2.5 shrink-0 print:hidden">
          {!activeSimulation?.isCompleted && (
            checkpointSubmitted ? (
              <Button
                onClick={() => navigate(getFirstStrategyPath())}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-11 px-5 rounded-xl shadow-md flex items-center gap-1.5"
              >
                Proceed to Day {currentRound} Strategy
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => navigate("/simulation/checkpoint")}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs h-11 px-5 rounded-xl shadow-md flex items-center gap-1.5"
              >
                Write Checkpoint Justification
                <ArrowRight className="h-4 w-4" />
              </Button>
            )
          )}
        </div>
      </div>

      {/* Main Grid: Dashboard Left + Sidebar Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* LEFT COLUMN: Main Analytics (Col span 3) */}
        <div className="lg:col-span-3 space-y-6 print:col-span-full print:w-full print:border-none print:shadow-none">

          {/* Section 1: Phase 2A Overall Round Scores & Strategic alignment */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Round Summary Card */}
            <Card className="border-neutral-200/80 shadow-sm bg-white p-5 flex flex-col justify-between text-left">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full">
                  Performance Index
                </span>
                <CardTitle className="text-sm font-black text-neutral-900 mt-2">Day {currentRound - 1 || 1} Performance Overview</CardTitle>
              </div>
              
              <div className="my-4 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-3xl font-black text-neutral-900">{overallScore}%</span>
                  <span className="text-xs text-neutral-400 font-semibold">Overall Composite</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600" style={{ width: `${overallScore}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-t border-neutral-100 pt-3">
                <div>
                  <span className="text-[9px] font-black text-neutral-400 uppercase">Classroom Rank</span>
                  <span className="block font-black text-neutral-800 mt-0.5">#{classRank} of {totalStudents}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-neutral-400 uppercase">Percentile</span>
                  <span className="block font-black text-indigo-600 mt-0.5">
                    {Math.max(1, Math.round(((totalStudents - classRank) / (totalStudents || 1)) * 100))}%
                  </span>
                </div>
              </div>
            </Card>

            {/* Strategic Dimension Radar list */}
            <Card className="md:col-span-2 border-neutral-200/80 shadow-sm bg-white p-5 text-left flex flex-col justify-between">
              <div>
                <CardTitle className="text-xs font-black text-neutral-500 uppercase tracking-wider">Strategic Dimensions Scores</CardTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mt-3.5">
                  {strategicScores.map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold text-neutral-700">
                        <span className="truncate" title={item.description}>{item.label}</span>
                        <span className="text-indigo-600">{item.score}%</span>
                      </div>
                      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${item.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-[10px] text-neutral-400 font-bold border-t border-neutral-100 pt-3 mt-4">
                💡 Alignment ratings are calculated relative to optimal bidding models, campaign keyword relevancy, and risk structures.
              </div>
            </Card>
          </div>

          {/* Section 2: Phase 2B 12 KPI Analytics Grid */}
          <div className="space-y-3">
            <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest text-left">
              Key Performance Indicator Analytics (12-Channel Analysis)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-left">
              {filteredKpis.map((kpi) => {
                const KpiIcon = kpi.icon
                const isPositive = kpi.growth.trend === "up"
                const isNegative = kpi.growth.trend === "down"
                
                return (
                  <div key={kpi.label} className="bg-white border border-neutral-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-2 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-black text-neutral-400 uppercase tracking-wider block">{kpi.label}</span>
                      <KpiIcon className={`h-4 w-4 ${kpi.color} shrink-0`} />
                    </div>
                    
                    <div>
                      <span className="text-lg sm:text-xl font-black text-neutral-900 block leading-tight">{kpi.value}</span>
                      {kpi.extra && <span className="text-[9px] text-neutral-400 font-bold block">{kpi.extra}</span>}
                    </div>

                    <div className="flex justify-between items-center text-[10px] border-t border-neutral-50/50 pt-2">
                      <span className="text-neutral-400 font-semibold">Prev: {kpi.prevText}</span>
                      {kpi.growth.trend !== "neutral" ? (
                        <span className={`font-black flex items-center gap-0.5 ${
                          isPositive 
                            ? "text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md" 
                            : isNegative 
                              ? "text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md" 
                              : "text-neutral-500"
                        }`}>
                          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {kpi.growth.text}
                        </span>
                      ) : (
                        <span className="text-neutral-400 font-bold bg-neutral-50 px-1.5 py-0.5 rounded-md">Flat</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section 3: Phase 2C Visual Analytics Trends (Tabs & Recharts) */}
          <Card className="border-neutral-200/80 shadow-sm bg-white p-5 space-y-4 text-left">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <CardTitle className="text-sm font-black text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-4.5 w-4.5 text-indigo-500" />
                  Visual Trend Analytics
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-neutral-400">
                  Performance progression metrics plotted across all completed simulation rounds
                </CardDescription>
              </div>

              {/* Chart Tabs */}
              <div className="flex flex-wrap gap-1 print:hidden bg-neutral-50 p-1 rounded-xl border border-neutral-100">
                {[
                  { id: "revenue", label: "Revenue" },
                  { id: "traffic", label: "Traffic" },
                  { id: "conversion", label: "Conversions" },
                  { id: "ctr", label: "CTR" },
                  { id: "authority", label: "Authority" },
                  { id: "ranking", label: "Rankings" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveChartTab(tab.id as any)}
                    className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-all ${
                      activeChartTab === tab.id
                        ? "bg-white text-indigo-600 shadow-sm border border-neutral-100"
                        : "text-neutral-500 hover:text-neutral-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Container */}
            <div className="min-w-0 min-h-[260px] h-[280px] w-full pt-2">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  {activeChartTab === "revenue" && (
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="roundName" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                      <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]} />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#colorRevenue)" strokeWidth={2} />
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  )}
                  
                  {activeChartTab === "traffic" && (
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="roundName" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                      <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                      <Tooltip />
                      <Area type="monotone" dataKey="traffic" stroke="#6366f1" fill="url(#colorTraffic)" strokeWidth={2} name="Total Visits" />
                      <defs>
                        <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  )}

                  {activeChartTab === "conversion" && (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="roundName" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                      <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                      <Tooltip />
                      <Line type="monotone" dataKey="conversions" stroke="#14b8a6" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 7 }} name="Conversions" />
                    </LineChart>
                  )}

                  {activeChartTab === "ctr" && (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="roundName" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                      <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(value) => [`${value}%`, "Click-Through Rate"]} />
                      <Line type="monotone" dataKey="ctr" stroke="#06b6d4" strokeWidth={3} dot={{ r: 5 }} name="CTR %" />
                    </LineChart>
                  )}

                  {activeChartTab === "authority" && (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="roundName" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                      <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                      <Tooltip />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      <Line type="monotone" dataKey="pageAuthority" stroke="#a855f7" strokeWidth={2.5} name="Page Authority (PA)" />
                      <Line type="monotone" dataKey="domainAuthority" stroke="#ec4899" strokeWidth={2.5} name="Domain Authority (DA)" />
                    </LineChart>
                  )}

                  {activeChartTab === "ranking" && (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="roundName" stroke="#94a3b8" fontSize={9} fontWeight="bold" />
                      {/* Reversed Y-axis because lower rank number (1) is better */}
                      <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" reversed />
                      <Tooltip formatter={(value) => [`Pos: #${value}`, "Avg Keyword Rank"]} />
                      <Line type="monotone" dataKey="averageRank" stroke="#f43f5e" strokeWidth={3} dot={{ r: 5 }} name="Avg Keywords Rank" />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-neutral-200 rounded-xl bg-neutral-50/50">
                  <span className="text-xs text-neutral-400 font-bold">Accumulate multiple rounds of simulation to render history charts.</span>
                </div>
              )}
            </div>
          </Card>

          {/* Section 4: Phase 2D Market Events Analysis Timeline */}
          <Card className="border-neutral-200/80 shadow-sm bg-white p-5 space-y-4 text-left">
            <CardTitle className="text-sm font-black text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-4.5 w-4.5 text-indigo-500" />
              Market Events & Algorithm Changes Timeline
            </CardTitle>
            
            <div className="relative border-l border-neutral-200 pl-4 ml-2.5 space-y-5 py-2">
              {events.length > 0 ? (
                events.map((ev: any, idx: number) => {
                  const hasBoost = ev.impactMultiplier > 1
                  const pct = Math.abs(Math.round((ev.impactMultiplier - 1) * 100))
                  
                  return (
                    <div key={ev.id || idx} className="relative space-y-1">
                      {/* Circle indicator on timeline */}
                      <span className="absolute -left-[22px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-600 shadow-sm" />
                      
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 rounded-md">
                          Round {ev.round}
                        </span>
                        <h4 className="text-xs font-black text-neutral-800">{ev.name}</h4>
                        
                        <span className={`text-[9px] font-black uppercase px-2 rounded-full leading-relaxed ml-auto ${
                          hasBoost ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          Impact: {hasBoost ? "+" : "-"}{pct}%
                        </span>
                      </div>
                      
                      <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
                        {ev.description}
                      </p>
                      
                      <div className="text-[10px] font-bold text-neutral-400">
                        {ev.type === "SEO_MULTIPLIER" && "🛡️ Google core indexing crawler update. Affects organic search index and click efficiencies."}
                        {ev.type === "CONVERSION_SPIKE" && "⚡ Seasonal conversion rush. Alters baseline checkout intention across all product landings."}
                        {ev.type === "CPC_SPIKE" && "💸 Competitor auction bid pressure. Increases Google Ads cost-per-click averages."}
                        {ev.type === "META_MULTIPLIER" && "📱 Mobile privacy tracking restriction. Alters paid social reach conversion efficiency."}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-xs text-neutral-400 font-semibold pl-1">
                  No market events triggered for this simulation cohort. Events randomly trigger during round completers.
                </div>
              )}
            </div>
          </Card>

          {/* Section 5: Phase 2E AI Insights Coaching Panel */}
          <div className="space-y-4 text-left">
            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">
              AI Marketing Coach & Advisory Panel
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Dynamic feedback panel */}
              <Card className="border-neutral-200/80 shadow-sm bg-white p-5 space-y-4">
                <span className="text-xs font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                  What Went Well
                </span>
                <p className="text-xs text-neutral-600 font-semibold leading-relaxed">{wellText}</p>

                <span className="text-xs font-black text-rose-600 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded-full inline-block mt-4">
                  What Went Wrong
                </span>
                <p className="text-xs text-neutral-600 font-semibold leading-relaxed">{wrongText}</p>
                
                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-4">
                  Optimization suggestions
                </span>
                <ul className="text-xs text-neutral-500 list-disc pl-4 space-y-1 font-semibold leading-relaxed">
                  <li>Review targeted SEO keywords. Prune terms with higher competition indices to recover positions.</li>
                  <li>Reallocate under-spent Meta budgets into Google Ads when search CPC stabilizes.</li>
                  <li>Incorporate new video assets in paid social creatives to defend placement quality scores.</li>
                </ul>
              </Card>

              {/* Actionable recommendations panel */}
              <Card className="border-neutral-200/80 shadow-sm bg-white p-5 space-y-4">
                {allowed.includes("SEO") && (
                  <div>
                    <h4 className="text-xs font-black text-neutral-900 uppercase">SEO Recommendations</h4>
                    <p className="text-xs text-neutral-500 font-bold leading-relaxed mt-1">
                      {insights.find((i) => i.title.toLowerCase().includes("seo"))?.description || 
                       "Organic indexing stability is key. Retain Content Quality scores at 7+ to increase Domain authority conversion rate."}
                    </p>
                  </div>
                )}
                
                {(allowed.includes("GOOGLE_ADS") || allowed.includes("META_ADS")) && (
                  <div className={allowed.includes("SEO") ? "border-t border-neutral-100 pt-3" : ""}>
                    <h4 className="text-xs font-black text-neutral-900 uppercase">Paid Advertising recommendations</h4>
                    <p className="text-xs text-neutral-500 font-bold leading-relaxed mt-1">
                      {insights.find((i) => i.title.toLowerCase().includes("google") || i.title.toLowerCase().includes("meta"))?.description ||
                       "Tighten CPC bidding allocations. Focus ad copywriting around target location modifiers to boost Conversion rate."}
                    </p>
                  </div>
                )}

                <div className="border-t border-neutral-100 pt-3">
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider">Next Round pacing Strategy</h4>
                  <p className="text-xs text-neutral-650 font-bold leading-relaxed mt-1">
                    {allowed.includes("SEO") && allowed.includes("GOOGLE_ADS") && allowed.includes("META_ADS")
                      ? "Maintain budget pacing velocity. Divide the scenario's round budget 40% SEO Keywords content indexing, 35% Google Ads Search, and 25% Meta social to maximize conversion values."
                      : allowed.includes("GOOGLE_ADS") && allowed.includes("META_ADS")
                        ? "Maintain budget pacing velocity. Focus your daily budget on high-performing Google Ads search keywords and Meta Ads interest-based creatives to maximize conversions."
                        : allowed.includes("SEO") && allowed.includes("GOOGLE_ADS")
                          ? "Maintain budget pacing velocity. Divide budget between SEO keyword content optimization and Google Ads PPC bidding strategies."
                          : allowed.includes("SEO") && allowed.includes("META_ADS")
                            ? "Maintain budget pacing velocity. Focus on high-quality content indexing and backlink acquisition alongside targeted Meta Ads campaigns."
                            : allowed.includes("SEO")
                              ? "Focus entirely on organic search traffic. Invest your budget into high-DA backlink outreach and optimizing keyword density to climb the SERP."
                              : allowed.includes("GOOGLE_ADS")
                                ? "Optimize search campaigns. Prune low-CTR keywords, improve ad relevance, and set competitive bids to maximize impression share and conversions."
                                : "Focus on social media campaigns. Revamp creative designs to avoid ad fatigue and target high-affinity lookalike audiences."
                    }
                  </p>
                </div>
              </Card>
            </div>
          </div>

          {/* Section 6: Phase 2F Classroom Benchmarks & Performance gaps */}
          <Card className="border-neutral-200/80 shadow-sm bg-white p-5 space-y-4 text-left">
            <CardTitle className="text-sm font-black text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-4.5 w-4.5 text-indigo-500" />
              Classroom Benchmarks & Performance Gap Analysis
            </CardTitle>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center my-2">
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-[10px] font-black text-neutral-400 uppercase">Current Round</span>
                <span className="block text-lg font-black text-indigo-600 mt-1">{overallScore}%</span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-[10px] font-black text-neutral-400 uppercase">Previous Round</span>
                <span className="block text-lg font-black text-neutral-700 mt-1">
                  {currentRound > 2 ? Math.round(breakdowns.find((b) => b.round === currentRound - 2)?.compositeIndex || 0) : 0}%
                </span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-[10px] font-black text-neutral-400 uppercase">Class Average</span>
                <span className="block text-lg font-black text-neutral-700 mt-1">{classAverage || 0}%</span>
              </div>
              <div className="p-3 bg-neutral-50 rounded-xl">
                <span className="text-[10px] font-black text-neutral-400 uppercase">Top Performer</span>
                <span className="block text-lg font-black text-emerald-600 mt-1">{topPerformerScore || 100}%</span>
              </div>
            </div>

            <div className="divide-y divide-neutral-100 text-xs border-t border-neutral-100 pt-2">
              <div className="py-2 flex justify-between items-center font-semibold">
                <span className="text-neutral-500">Peer Performance Gap</span>
                <span className="text-rose-600 font-black">
                  {performanceGap > 0 ? `-${performanceGap}% points behind top performer` : "Leading classroom cohort!"}
                </span>
              </div>
              <div className="py-2 flex justify-between items-center font-semibold">
                <span className="text-neutral-500">Recommended Target</span>
                <span className="text-emerald-600 font-black">{recommendedTarget}% Composite Score</span>
              </div>
              <div className="py-2 flex justify-between items-center font-semibold">
                <span className="text-neutral-500">Gap Strategy</span>
                <span className="text-neutral-600 font-bold">
                  Scale backlink budgets to raise Domain authority. Maintain high Meta creative quality.
                </span>
              </div>
            </div>
          </Card>

        </div>

        {/* RIGHT COLUMN: Sidebar (Col span 1) */}
        <div className="lg:col-span-1 space-y-6 print:hidden">

          {/* Sidebar 1: Phase 2G Export Toolbox */}
          <Card className="border-neutral-200/80 shadow-sm bg-white p-5 space-y-4 text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Reports Export Toolbox</span>
            <div className="space-y-2.5">
              <Button 
                onClick={handleExportCSV}
                className="w-full text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-950 h-9 rounded-xl flex items-center justify-center gap-1.5"
              >
                <Download className="h-4 w-4" />
                Export CSV Dataset
              </Button>
              <Button 
                onClick={handlePrintPDF}
                variant="outline"
                className="w-full text-xs font-bold border-neutral-200 hover:bg-neutral-50 h-9 rounded-xl flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Print PDF Report
              </Button>
            </div>
            <div className="text-[10px] text-neutral-400 font-semibold leading-relaxed border-t border-neutral-100 pt-3">
              📝 Export triggers save formatted analytical metrics including spend allocations, CPA averages, and classroom percentiles.
            </div>
          </Card>

          {/* Sidebar 2: Phase 2H Leaderboard Preview */}
          {(!activeSimulation?.classId || user?.role?.toLowerCase() === "individual") ? null : (
            <Card className="border-neutral-200/80 shadow-sm bg-white p-5 space-y-4 text-left">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Leaderboard Preview</span>
                <span className="text-[9px] font-black text-indigo-600 uppercase">Rank: #{classRank}</span>
              </div>

              <div className="space-y-3 my-2">
                {leaderboard.slice(0, 5).map((peer, idx) => {
                  const isUser = peer.id === activeSimulation?.id
                  return (
                    <div 
                      key={peer.id || idx}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                        isUser 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-900" 
                          : "bg-white border-neutral-100 text-neutral-700"
                      }`}
                    >
                      <span className="text-[10px] font-black w-4 text-neutral-400">{idx + 1}</span>
                      <div className="flex-1 truncate">
                        <span className="text-xs font-black truncate block">{peer.user?.name || "Peer Student"}</span>
                        <span className="text-[9px] text-neutral-400 block font-semibold">Round {peer.currentRound || 1}</span>
                      </div>
                      <span className="text-xs font-black shrink-0">{Math.round(peer.score || 0)}%</span>
                    </div>
                  )
                })}
              </div>
              
              {leaderboard.length > 5 && (
                <div className="text-[10px] text-neutral-400 text-center font-bold border-t border-neutral-100 pt-2">
                  ...and {leaderboard.length - 5} other students
                </div>
              )}
            </Card>
          )}

          {/* Sidebar 3: Quick Checklist */}
          <Card className="border-neutral-200/80 shadow-md bg-white p-6 text-left space-y-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Next Campaign Checklist</span>
            
            <div className="space-y-3">
              {[
                allowed.includes("SEO") && { label: "Refine On-Page keywords & backlinks", path: "/simulation/seo" },
                allowed.includes("GOOGLE_ADS") && { label: "Update Google PPC search bids", path: "/simulation/google-ads" },
                allowed.includes("META_ADS") && { label: "Revamp Meta social ad creatives", path: "/simulation/meta-ads" },
              ].filter(Boolean).map((item: any, idx) => (
                <Link key={idx} to={item.path} className="flex items-start gap-2.5 group">
                  <CheckCircle className="h-4.5 w-4.5 text-neutral-300 group-hover:text-indigo-500 shrink-0 mt-0.5 transition-colors" />
                  <span className="text-xs font-bold text-neutral-600 group-hover:text-indigo-600 leading-snug transition-colors">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </Card>

        </div>

      </div>

    </div>
  )
}
export default SimulationResultsPage;
