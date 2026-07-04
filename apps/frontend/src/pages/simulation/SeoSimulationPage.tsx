import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Search, Play, ArrowLeft, TrendingUp, Sparkles, BookOpen, AlertTriangle,
  CheckCircle2, ShieldCheck, Eye, Terminal, Activity,
  ChevronUp, ArrowRight
} from "lucide-react"
import { Link, useNavigate, useLocation } from "react-router"
import { useCampaignStore, AVAILABLE_KEYWORDS } from "@/stores/campaignStore"
import { useSimulationStore } from "@/stores/simulationStore"
import { useAuthStore } from "@/stores/authStore"
import { normalizeRole } from "@/lib/normalizeRole"
import { SimulationProgressTracker } from "@/components/simulation/SimulationProgressTracker"
import { toast } from "sonner"
import api from "@/lib/api"

// ─── Helpers ─────────────────────────────────────────────────────────────────
const StatusIcon = ({ status }: { status: string }) => {
  if (status === "green") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
  if (status === "yellow") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
  return <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
}

const StatusBg = (status: string) => {
  if (status === "green") return "bg-emerald-50 text-emerald-800 border-emerald-200"
  if (status === "yellow") return "bg-amber-50/70 text-amber-800 border-amber-200"
  return "bg-rose-50/70 text-rose-800 border-rose-200"
}

const vitalsLabel = (metric: string, val: number) => {
  if (metric === "lcp") return val <= 2.5 ? "Good" : val <= 4.0 ? "Needs Work" : "Poor"
  if (metric === "cls") return val <= 0.1 ? "Good" : val <= 0.25 ? "Needs Work" : "Poor"
  if (metric === "fid") return val <= 100 ? "Good" : val <= 300 ? "Needs Work" : "Poor"
  return "Unknown"
}

const vitalsColor = (metric: string, val: number) => {
  const label = vitalsLabel(metric, val)
  if (label === "Good") return "text-emerald-600"
  if (label === "Needs Work") return "text-amber-500"
  return "text-rose-500"
}

const difficultyConfig = (kw: string) => {
  const hash = kw.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const level = hash % 4
  const labels = [
    { label: "Low", color: "bg-emerald-100 text-emerald-700", bar: "w-1/4 bg-emerald-500", score: 22 },
    { label: "Medium", color: "bg-amber-100 text-amber-700", bar: "w-2/4 bg-amber-500", score: 48 },
    { label: "High", color: "bg-orange-100 text-orange-700", bar: "w-3/4 bg-orange-500", score: 68 },
    { label: "Very High", color: "bg-rose-100 text-rose-700", bar: "w-full bg-rose-500", score: 87 },
  ]
  return labels[level]
}

// ─── Simulated SERP Competitors ───────────────────────────────────────────────
const COMPETITOR_SNIPPETS = [
  { domain: "searchpro.io", title: "The #1 Rated Marketing Analytics Suite", desc: "Industry-leading tools for keyword research, rank tracking, and competitive analysis." },
  { domain: "marketinglab.co", title: "Digital Marketing Learning Platform 2024", desc: "Learn Google Ads, SEO, and paid social from expert-certified courses." },
  { domain: "growthsuite.com", title: "All-in-One Marketing Automation Tool", desc: "Automate SEO audits, ad campaigns, and social reporting in one dashboard." },
]

export function SeoSimulationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isSimulationMode = location.pathname.startsWith("/simulation")

  const campaignStore = useCampaignStore()
  const { activeSimulation, saveDecisions } = useSimulationStore()
  const { user } = useAuthStore()

  const isReadOnly = user?.role === 'admin' || activeSimulation?.status === 'LOCKED' || activeSimulation?.status === 'COMPLETED'
  const [isSaving, setIsSaving] = useState(false)

  // ── On-Page States ─────────────────────────────────────────────────────────
  const [focusKeyword, setFocusKeyword] = useState("digital marketing")
  const [metaTitle, setMetaTitle] = useState("Best Digital Marketing Platform | Learn Marketing Analytics")
  const [metaDescription, setMetaDescription] = useState("Transform your career with SimpLab, the best digital marketing platform. Learn keyword bidding, SEO, and paid social analytics via real-world algorithms.")
  const [urlSlug, setUrlSlug] = useState("best-digital-marketing-platform")
  const [bodyContent, setBodyContent] = useState("In the modern business landscape, digital marketing has become the cornerstone of brand growth. Implementing a solid digital marketing strategy involves understanding search engine optimization, pay-per-click ads, and user conversion funnels. SimpLab is a premier digital marketing platform built to help students and instructors explore marketing algorithms, bidding models, and organic indexing projections in real time. Learn search ads optimization, social feeds CTR, and ROI tracking under realistic constraints.")

  // ── Technical Checklist ────────────────────────────────────────────────────
  const [hasSitemap, setHasSitemap] = useState(true)
  const [hasRobots, setHasRobots] = useState(true)
  const [hasSsl, setHasSsl] = useState(true)
  const [isMobileFriendly, setIsMobileFriendly] = useState(true)
  const [hasAltTags, setHasAltTags] = useState(false)
  const [hasSchema, setHasSchema] = useState(false)

  // ── Core Web Vitals ────────────────────────────────────────────────────────
  const [lcpMs, setLcpMs] = useState(2.1)   // Largest Contentful Paint (seconds)
  const [clsScore, setClsScore] = useState(0.08) // Cumulative Layout Shift
  const [fidMs, setFidMs] = useState(85)    // First Input Delay (ms)

  // ── Off-Page ───────────────────────────────────────────────────────────────
  const [backlinkBudget, setBacklinkBudget] = useState(500)
  const [backlinkQuality, setBacklinkQuality] = useState(3)

  // ── Internal Linking ────────────────────────────────────────────────────────
  const [internalLinksCount, setInternalLinksCount] = useState(3)
  const [anchorText, setAnchorText] = useState("digital marketing")
  const [internalLinksScore, setInternalLinksScore] = useState(50)

  // ── Results ────────────────────────────────────────────────────────────────
  const [onPageScore, setOnPageScore] = useState(0)
  const [techScore, setTechScore] = useState(0)
  const [offPageScore, setOffPageScore] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [auditItems, setAuditItems] = useState<any[]>([])
  const [projectedTraffic, setProjectedTraffic] = useState(0)
  const [projectedConversions, setProjectedConversions] = useState(0)
  const [serpRank, setSerpRank] = useState(0)
  const [simLoading, setSimLoading] = useState(false)
  const [runSuccess, setRunSuccess] = useState(false)
  const [activeSection, setActiveSection] = useState<"content" | "technical" | "vitals" | "offpage">("content")

  // Load from store on mount in simulation mode
  useEffect(() => {
    if (isSimulationMode) {
      if (campaignStore.metaTitle) setMetaTitle(campaignStore.metaTitle)
      if (campaignStore.metaDescription) setMetaDescription(campaignStore.metaDescription)
      if (campaignStore.bodyContent) setBodyContent(campaignStore.bodyContent)
      if (campaignStore.urlSlug) setUrlSlug(campaignStore.urlSlug)
      if (campaignStore.internalLinksCount !== undefined) setInternalLinksCount(campaignStore.internalLinksCount)
      if (campaignStore.anchorText) setAnchorText(campaignStore.anchorText)
      if (campaignStore.backlinkQuality !== undefined) setBacklinkQuality(campaignStore.backlinkQuality)
      
      if (campaignStore.technicalConfig) {
        try {
          const tc = JSON.parse(campaignStore.technicalConfig)
          if (tc.hasSitemap !== undefined) setHasSitemap(tc.hasSitemap)
          if (tc.hasRobots !== undefined) setHasRobots(tc.hasRobots)
          if (tc.hasSsl !== undefined) setHasSsl(tc.hasSsl)
          if (tc.isMobileFriendly !== undefined) setIsMobileFriendly(tc.isMobileFriendly)
          if (tc.hasAltTags !== undefined) setHasAltTags(tc.hasAltTags)
          if (tc.hasSchema !== undefined) setHasSchema(tc.hasSchema)
        } catch(e) {}
      }
      
      if (campaignStore.webVitals) {
        try {
          const wv = JSON.parse(campaignStore.webVitals)
          if (wv.lcpMs !== undefined) setLcpMs(wv.lcpMs)
          if (wv.clsScore !== undefined) setClsScore(wv.clsScore)
          if (wv.fidMs !== undefined) setFidMs(wv.fidMs)
        } catch(e) {}
      }

      if (campaignStore.selectedKeywords && campaignStore.selectedKeywords.length > 0) {
        const kwId = campaignStore.selectedKeywords[0]
        const kwObj = AVAILABLE_KEYWORDS.find(k => k.id === kwId || k.name === kwId)
        setFocusKeyword(kwObj ? kwObj.name : kwId)
      }
      if (campaignStore.budgetSpent) setBacklinkBudget(campaignStore.budgetSpent)
    }
  }, [isSimulationMode])

  useEffect(() => {
    const checkGating = async () => {
      const isCollegeStudent = normalizeRole(user?.role) === "STUDENT"
      if (isSimulationMode && isCollegeStudent && activeSimulation && activeSimulation.currentRound > 1) {
        try {
          const checkRes = await api.get<{ success: boolean; checkpoints: any[] }>(`/api/v1/simulation/checkpoint/${activeSimulation.id}`)
          if (checkRes.data?.success) {
            const hasPrevCheckpoint = checkRes.data.checkpoints.some(
              cp => cp.roundNumber === activeSimulation.currentRound - 1
            )
            if (!hasPrevCheckpoint) {
              toast.error("Mandatory checkpoint justification must be submitted before editing decisions.")
              navigate("/simulation/checkpoint")
            }
          }
        } catch (e) {
          console.error("Error checking checkpoint gating:", e)
        }
      }
    }
    checkGating()
  }, [isSimulationMode, activeSimulation, user, navigate])

  // Sync scores back to Zustand store
  useEffect(() => {
    if (isSimulationMode) {
      campaignStore.setOnPageScore(onPageScore)
      campaignStore.setTechnicalScore(techScore)
      campaignStore.setBacklinkScore(offPageScore)
      campaignStore.calculateTotalScore()
    }
  }, [onPageScore, techScore, offPageScore, isSimulationMode])

  const allowed = activeSimulation?.allowedPlatforms || ["SEO", "GOOGLE_ADS", "META_ADS"]

  const getNextStepPath = () => {
    if (allowed.includes("GOOGLE_ADS")) return "/simulation/google-ads"
    if (allowed.includes("META_ADS")) return "/simulation/meta-ads"
    return "/simulation/results"
  }

  const getButtonText = () => {
    const nextPath = getNextStepPath()
    if (isSaving) return "Saving Decisions..."
    if (nextPath === "/simulation/results") {
      return isReadOnly ? "Next: Results" : "Submit & Lock Decisions"
    } else {
      return isReadOnly 
        ? (nextPath === "/simulation/google-ads" ? "Next: Google Ads" : "Next: Meta Ads") 
        : "Save & Continue"
    }
  }

  const handleSaveAndContinue = async () => {
    setIsSaving(true)
    const nextPath = getNextStepPath()
    try {
      if (isReadOnly) {
        navigate(nextPath)
        return
      }
      // Set keywords
      const kw = AVAILABLE_KEYWORDS.find(k => k.name.toLowerCase() === focusKeyword.toLowerCase() || k.id === focusKeyword)
      useCampaignStore.setState({ 
        selectedKeywords: [kw ? kw.id : focusKeyword],
        budgetSpent: backlinkBudget,
        metaTitle,
        metaDescription,
        bodyContent,
        urlSlug,
        internalLinksCount,
        anchorText,
        backlinkQuality,
        technicalConfig: JSON.stringify({ hasSitemap, hasRobots, hasSsl, isMobileFriendly, hasAltTags, hasSchema }),
        webVitals: JSON.stringify({ lcpMs, clsScore, fidMs })
      })

      await saveDecisions()
      
      if (nextPath === "/simulation/results") {
        const { advanceSimulation } = useSimulationStore.getState()
        await advanceSimulation()
        toast.success("Decisions submitted and locked!")
      } else {
        toast.success("SEO decisions saved successfully!")
      }
      navigate(nextPath)
    } catch (error) {
      console.error(error)
      toast.error("Failed to save decisions.")
    } finally {
      setIsSaving(false)
    }
  }

  // ── Live Audit Calculator ──────────────────────────────────────────────────
  useEffect(() => {
    const titleLen = metaTitle.length
    const titleKeyword = metaTitle.toLowerCase().includes(focusKeyword.toLowerCase())
    const isTitleOptimal = titleLen >= 50 && titleLen <= 60

    const descLen = metaDescription.length
    const descKeyword = metaDescription.toLowerCase().includes(focusKeyword.toLowerCase())
    const isDescOptimal = descLen >= 120 && descLen <= 160

    const words = bodyContent.split(/\s+/).filter(Boolean)
    const wordCount = words.length
    const keywordOccurrences = focusKeyword ? (bodyContent.toLowerCase().split(focusKeyword.toLowerCase()).length - 1) : 0
    const keywordDensity = wordCount > 0 ? (keywordOccurrences / wordCount) * 100 : 0
    const isDensityOptimal = keywordDensity >= 0.8 && keywordDensity <= 2.2

    const items: any[] = []
    let opScore = 0  // on-page (max 55)
    let tScore = 0   // technical (max 30)
    let ofScore = 0  // off-page (max 15)

    // On-page scoring (55 pts)
    if (isTitleOptimal) { items.push({ text: `Meta Title optimal (${titleLen} chars)`, status: "green", section: "onpage" }); opScore += 15 }
    else { items.push({ text: `Meta Title length suboptimal (${titleLen} chars) — aim for 50-60`, status: titleLen === 0 ? "red" : "yellow", section: "onpage" }); opScore += titleLen > 0 ? 7 : 0 }

    if (focusKeyword && titleKeyword) { items.push({ text: "Focus keyword in Meta Title", status: "green", section: "onpage" }); opScore += 10 }
    else if (focusKeyword) { items.push({ text: "Focus keyword missing from Meta Title", status: "red", section: "onpage" }) }

    if (isDescOptimal) { items.push({ text: `Meta Description optimal (${descLen} chars)`, status: "green", section: "onpage" }); opScore += 10 }
    else { items.push({ text: `Meta Description suboptimal (${descLen} chars) — aim for 120-160`, status: descLen === 0 ? "red" : "yellow", section: "onpage" }); opScore += descLen > 0 ? 5 : 0 }

    if (focusKeyword && descKeyword) { items.push({ text: "Focus keyword in Meta Description", status: "green", section: "onpage" }); opScore += 8 }
    else if (focusKeyword) { items.push({ text: "Focus keyword missing from Meta Description", status: "red", section: "onpage" }) }

    if (wordCount >= 300) { items.push({ text: `Content length optimal (${wordCount} words)`, status: "green", section: "onpage" }); opScore += 7 }
    else { items.push({ text: `Content too short (${wordCount} words) — aim for 300+ words`, status: wordCount < 100 ? "red" : "yellow", section: "onpage" }); opScore += wordCount >= 100 ? 3 : 0 }

    if (focusKeyword && isDensityOptimal) { items.push({ text: `Keyword density optimal (${keywordDensity.toFixed(1)}%)`, status: "green", section: "onpage" }); opScore += 5 }
    else if (focusKeyword && keywordDensity > 2.5) { items.push({ text: `Keyword stuffing (${keywordDensity.toFixed(1)}%) — keep below 2.5%`, status: "red", section: "onpage" }) }
    else if (focusKeyword && keywordDensity > 0) { items.push({ text: `Keyword density low (${keywordDensity.toFixed(1)}%) — aim for 1-2%`, status: "yellow", section: "onpage" }); opScore += 2 }
    else { items.push({ text: "Focus keyword not found in body text", status: "red", section: "onpage" }) }

    // Technical scoring (30 pts)
    if (hasSsl) { items.push({ text: "SSL (HTTPS) enabled", status: "green", section: "tech" }); tScore += 8 }
    else { items.push({ text: "SSL certificate missing — critical ranking signal", status: "red", section: "tech" }) }
    if (hasSitemap) { items.push({ text: "Sitemap.xml available", status: "green", section: "tech" }); tScore += 5 }
    else { items.push({ text: "Sitemap.xml missing", status: "yellow", section: "tech" }) }
    if (hasRobots) { items.push({ text: "Robots.txt configured", status: "green", section: "tech" }); tScore += 4 }
    else { items.push({ text: "Robots.txt missing", status: "yellow", section: "tech" }) }
    if (isMobileFriendly) { items.push({ text: "Mobile-responsive viewport detected", status: "green", section: "tech" }); tScore += 7 }
    else { items.push({ text: "Page not mobile-responsive — major ranking penalty", status: "red", section: "tech" }) }
    if (hasAltTags) { items.push({ text: "Image alt text attributes configured", status: "green", section: "tech" }); tScore += 3 }
    else { items.push({ text: "Images missing alt text", status: "yellow", section: "tech" }) }
    if (hasSchema) { items.push({ text: "JSON-LD Schema markup detected", status: "green", section: "tech" }); tScore += 3 }
    else { items.push({ text: "No structured Schema markup", status: "yellow", section: "tech" }) }

    // Core Web Vitals scoring (part of tech)
    const lcpGood = lcpMs <= 2.5
    const clsGood = clsScore <= 0.1
    const fidGood = fidMs <= 100
    const vitalsBonus = (lcpGood ? 4 : lcpMs <= 4.0 ? 2 : 0) + (clsGood ? 3 : clsScore <= 0.25 ? 1 : 0) + (fidGood ? 3 : fidMs <= 300 ? 1 : 0)
    // Vitals counted in tech (capped at remaining)
    const techWithVitals = Math.min(30, tScore + vitalsBonus)
    tScore = techWithVitals

    // Off-page scoring (15 pts)
    const blBudgetScore = Math.min(8, Math.floor(backlinkBudget / 100))
    const blQualScore = Math.min(7, backlinkQuality + 1)
    ofScore = blBudgetScore + blQualScore

    // Internal link scoring (100 pts scale)
    const countContribution = Math.min(50, internalLinksCount * 10)
    const anchorContribution = focusKeyword && anchorText.toLowerCase().includes(focusKeyword.toLowerCase()) ? 50 : 20
    const linkScoreVal = internalLinksCount > 0 ? Math.min(100, countContribution + anchorContribution) : 0
    setInternalLinksScore(linkScoreVal)

    // Add internal link audit items
    if (internalLinksCount >= 3) {
      items.push({ text: `Internal links count optimal (${internalLinksCount} links)`, status: "green", section: "links" })
    } else {
      items.push({ text: `Low internal linking (${internalLinksCount} links) — aim for 3+ for PageRank distribution`, status: "yellow", section: "links" })
    }
    if (focusKeyword && anchorText.toLowerCase().includes(focusKeyword.toLowerCase())) {
      items.push({ text: "Anchor text matches focus keyword", status: "green", section: "links" })
    } else {
      items.push({ text: "Anchor text does not include focus keyword — optimization opportunity", status: "yellow", section: "links" })
    }

    // Weigh total score: On-page + Technical + Off-page + link score bonus up to 100
    const total = Math.min(100, Math.round(opScore + tScore + ofScore + (linkScoreVal * 0.05)))
    setOnPageScore(opScore)
    setTechScore(tScore)
    setOffPageScore(ofScore)
    setTotalScore(total)
    setAuditItems(items)

    // SERP rank projection (1-10 scale based on total score)
    const rank = total >= 90 ? 1 : total >= 80 ? 2 : total >= 70 ? 3 : total >= 60 ? 5 : total >= 50 ? 7 : 10
    setSerpRank(rank)

    // Traffic & conversion projections
    const difficulty = difficultyConfig(focusKeyword)
    const diffMultiplier = difficulty.score <= 30 ? 1.4 : difficulty.score <= 55 ? 1.0 : difficulty.score <= 70 ? 0.7 : 0.4
    const backlinksBoost = (backlinkBudget * 0.8) * (backlinkQuality * 0.6)
    const baseTraffic = (total / 100) * 1200 * diffMultiplier
    const traffic = Math.round(baseTraffic + backlinksBoost + (wordCount * 0.15))
    setProjectedTraffic(traffic)
    setProjectedConversions(Math.round(traffic * 0.042))
  }, [focusKeyword, metaTitle, metaDescription, bodyContent, hasSitemap, hasRobots, hasSsl, isMobileFriendly, hasAltTags, hasSchema, backlinkBudget, backlinkQuality, lcpMs, clsScore, fidMs, internalLinksCount, anchorText])

  const handleRunAudit = () => {
    setSimLoading(true)
    setRunSuccess(false)
    setTimeout(() => { setSimLoading(false); setRunSuccess(true) }, 1500)
  }

  const difficulty = difficultyConfig(focusKeyword)

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">

      {isSimulationMode && <SimulationProgressTracker />}

      {/* Nav Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Link to={isSimulationMode ? "/simulation/briefing" : "/instructor"} className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {isSimulationMode ? "Back to Briefing" : "Back to Portal Dashboard"}
        </Link>
        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          {isSimulationMode ? `SEO Decisions (Round ${activeSimulation?.currentRound || 1})` : "SEO Simulation Sandbox"}
        </span>
      </div>

      {/* Page Title */}
      <div className="space-y-2 text-left">
        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 flex items-center gap-2.5">
          <Search className="h-7 w-7 text-indigo-600" />
          On-Page SEO Auditor & Rank Simulator
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 font-semibold max-w-3xl leading-relaxed">
          Configure your page's content, meta tags, technical signals, Core Web Vitals, and backlink strategy. The engine simulates how Google's ranking algorithm evaluates your page and predicts your SERP position.
        </p>
      </div>

      {/* Score Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Overall SEO Score", value: `${totalScore}%`, color: totalScore >= 80 ? "text-emerald-600" : totalScore >= 60 ? "text-amber-500" : "text-rose-500", bg: "bg-white" },
          { label: "On-Page Score", value: `${onPageScore}/55`, color: "text-indigo-600", bg: "bg-white" },
          { label: "Technical Score", value: `${techScore}/30`, color: "text-violet-600", bg: "bg-white" },
          { label: "Off-Page Score", value: `${offPageScore}/15`, color: "text-cyan-600", bg: "bg-white" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-neutral-200/80 shadow-sm p-4 text-left`}>
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">{s.label}</span>
            <span className={`text-xl font-black ${s.color} block mt-1`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Score breakdown bars */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm p-5 space-y-3">
        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Score Breakdown</span>
        {[
          { label: "On-Page Signals", score: onPageScore, max: 55, color: "bg-indigo-500" },
          { label: "Technical SEO & Core Web Vitals", score: techScore, max: 30, color: "bg-violet-500" },
          { label: "Off-Page Authority", score: offPageScore, max: 15, color: "bg-cyan-500" },
        ].map(b => (
          <div key={b.label} className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-neutral-500">
              <span>{b.label}</span>
              <span>{b.score}/{b.max}</span>
            </div>
            <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${b.color} rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(100, (b.score / b.max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Main 3-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Editor Sections ── */}
        <div className="lg:col-span-2 space-y-5 text-left">

          {/* Section Tab Switcher */}
          <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200/50 overflow-x-auto">
            {([
              { key: "content", label: "Content & Meta", icon: BookOpen },
              { key: "technical", label: "Technical SEO", icon: ShieldCheck },
              { key: "vitals", label: "Core Web Vitals", icon: Activity },
              { key: "offpage", label: "Off-Page & Links", icon: TrendingUp },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  activeSection === key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* CONTENT & META */}
          {activeSection === "content" && (
            <Card className="border-neutral-200/80 shadow-md bg-white animate-in fade-in duration-200">
              <CardHeader className="border-b border-neutral-100 p-5">
                <CardTitle className="text-sm font-black text-neutral-800 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-indigo-500" />
                  SEO Content Editor
                </CardTitle>
                <CardDescription className="text-xs font-medium text-neutral-400">
                  Configure your page's meta tags, URL slug, and body content. Audit results update in real-time.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-5">

                {/* Focus Keyword + Difficulty */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="focusKeyword">
                      Target Focus Keyword
                    </label>
                    <Input
                      id="focusKeyword"
                      value={focusKeyword}
                      disabled={isReadOnly}
                      onChange={e => setFocusKeyword(e.target.value)}
                      className="text-xs border-neutral-200 font-semibold h-10 focus-visible:ring-indigo-500"
                    />
                    {/* Keyword Difficulty */}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] font-black text-neutral-400 uppercase tracking-wide">Keyword Difficulty</span>
                      <Badge className={`${difficulty.color} border-none text-[9px] font-black`}>{difficulty.label}</Badge>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${difficulty.bar}`} />
                    </div>
                    <p className="text-[9px] text-neutral-400 font-semibold">
                      Difficulty score: {difficulty.score}/100 — affects how hard it is to rank on page 1
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="urlSlug">
                      Page URL Slug
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-[10px] text-neutral-400 font-semibold">example.com/</span>
                      <Input
                        id="urlSlug"
                        value={urlSlug}
                        disabled={isReadOnly}
                        onChange={e => setUrlSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                        className="text-xs border-neutral-200 font-semibold h-10 pl-28 focus-visible:ring-indigo-500"
                      />
                    </div>
                    <p className="text-[9px] text-neutral-400 font-semibold mt-1">Include your focus keyword in the URL slug for best practice.</p>
                  </div>
                </div>

                {/* Meta Title */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider" htmlFor="metaTitle">Meta Title Tag</label>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      metaTitle.length >= 50 && metaTitle.length <= 60 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}>
                      {metaTitle.length} / 60 chars (Optimal: 50–60)
                    </span>
                  </div>
                  <Input
                    id="metaTitle"
                    value={metaTitle}
                    disabled={isReadOnly}
                    onChange={e => setMetaTitle(e.target.value)}
                    className="text-xs border-neutral-200 font-semibold h-10 focus-visible:ring-indigo-500"
                  />
                </div>

                {/* Meta Description */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider" htmlFor="metaDesc">Meta Description Tag</label>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      metaDescription.length >= 120 && metaDescription.length <= 160 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}>
                      {metaDescription.length} / 160 chars (Optimal: 120–160)
                    </span>
                  </div>
                  <textarea
                    id="metaDesc"
                    rows={2}
                    value={metaDescription}
                    disabled={isReadOnly}
                    onChange={e => setMetaDescription(e.target.value)}
                    className="w-full text-xs p-3 border border-neutral-200 rounded-lg font-semibold text-neutral-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Body Content */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider" htmlFor="bodyText">Page Body Content</label>
                    <span className="text-[10px] font-bold bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">
                      {bodyContent.split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                  <textarea
                    id="bodyText"
                    rows={8}
                    value={bodyContent}
                    disabled={isReadOnly}
                    onChange={e => setBodyContent(e.target.value)}
                    className="w-full text-xs p-3 border border-neutral-200 rounded-lg font-medium text-neutral-800 bg-white leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* HTML Document Upload */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">HTML Document Upload</label>
                  <div className="border border-dashed border-neutral-200 rounded-xl p-4 bg-neutral-50/50 flex flex-col items-center justify-center text-center gap-2">
                    <span className="text-[10px] font-semibold text-neutral-500 leading-normal">
                      Drag & drop or select an HTML file to extract page titles, meta tags, and body content automatically.
                    </span>
                    <input
                      type="file"
                      accept=".html,.htm"
                      disabled={isReadOnly}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const html = event.target?.result as string;
                            // Extract title
                            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
                            if (titleMatch?.[1]) setMetaTitle(titleMatch[1].trim());

                            // Extract meta description
                            const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                                              html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
                            if (descMatch?.[1]) setMetaDescription(descMatch[1].trim());

                            // Strip HTML tags for body content
                            let tempBody = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                                               .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                                               .replace(/<[^>]+>/g, ' ')
                                               .replace(/\s+/g, ' ')
                                               .trim();
                            if (tempBody.length > 1000) tempBody = tempBody.substring(0, 1000) + '...';
                            setBodyContent(tempBody);
                            toast.success(`Successfully uploaded and parsed "${file.name}"!`);
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className="text-xs text-neutral-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[11px] file:font-black file:bg-indigo-50 file:text-indigo-750 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Internal Linking Optimization */}
                <div className="space-y-4 pt-4 border-t border-neutral-100">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-neutral-900 uppercase">Internal Linking Optimization</h4>
                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                      Link Score: {internalLinksScore}%
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">
                        Internal Links Pointing to Page
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={internalLinksCount}
                        disabled={isReadOnly}
                        onChange={(e) => setInternalLinksCount(parseInt(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-neutral-400 font-bold">
                        <span>0 Links</span>
                        <span>5 (Recommended)</span>
                        <span>10 Links</span>
                      </div>
                      <span className="text-[10px] text-neutral-600 font-bold block mt-1">
                        Active count: {internalLinksCount} incoming internal links
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="anchorText">
                        Target Anchor Text
                      </label>
                      <Input
                        id="anchorText"
                        value={anchorText}
                        disabled={isReadOnly}
                        onChange={(e) => setAnchorText(e.target.value)}
                        className="text-xs border-neutral-200 font-semibold h-10 focus-visible:ring-indigo-500"
                        placeholder="e.g. CRM Software or Sustainable Sneakers"
                      />
                      <p className="text-[9px] text-neutral-400 font-semibold leading-relaxed mt-1">
                        Anchor text matching focus keyword enhances indexing topical relevance.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TECHNICAL SEO */}
          {activeSection === "technical" && (
            <Card className="border-neutral-200/80 shadow-md bg-white animate-in fade-in duration-200">
              <CardHeader className="border-b border-neutral-100 p-5">
                <CardTitle className="text-sm font-black text-neutral-800 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-violet-500" />
                  Technical SEO Checklist
                </CardTitle>
                <CardDescription className="text-xs font-medium text-neutral-400">
                  Toggle site-wide technical configurations that affect Google's ability to crawl and index your site.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-0 divide-y divide-neutral-100">
                {[
                  { label: "SSL Enabled (HTTPS)", desc: "Encrypts connections. Critical ranking signal since 2014.", state: hasSsl, set: setHasSsl, pts: 8 },
                  { label: "Sitemap.xml Available", desc: "Helps Googlebot discover and index all URLs efficiently.", state: hasSitemap, set: setHasSitemap, pts: 5 },
                  { label: "Robots.txt Configured", desc: "Defines crawler access rules for each directory.", state: hasRobots, set: setHasRobots, pts: 4 },
                  { label: "Mobile-Responsive Viewport", desc: "Required for Google's Mobile-First Indexing since 2019.", state: isMobileFriendly, set: setIsMobileFriendly, pts: 7 },
                  { label: "Image Alt Text Attributes", desc: "Describes images to crawlers. Improves accessibility score.", state: hasAltTags, set: setHasAltTags, pts: 3 },
                  { label: "JSON-LD Schema Markup", desc: "Enables Rich Results (stars, FAQs, breadcrumbs) in SERPs.", state: hasSchema, set: setHasSchema, pts: 3 },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-4">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-800">{item.label}</span>
                        <Badge className={`${item.state ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"} border-none font-bold text-[9px]`}>
                          {item.state ? `+${item.pts} pts` : `0/${item.pts} pts`}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-medium">{item.desc}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.state}
                        disabled={isReadOnly}
                        onChange={e => item.set(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* CORE WEB VITALS */}
          {activeSection === "vitals" && (
            <Card className="border-neutral-200/80 shadow-md bg-white animate-in fade-in duration-200">
              <CardHeader className="border-b border-neutral-100 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-black text-neutral-800 uppercase tracking-wider flex items-center gap-2">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      Core Web Vitals (CWV)
                    </CardTitle>
                    <CardDescription className="text-xs font-medium text-neutral-400 mt-1">
                      Google's page experience signals. CWV directly impact SERP ranking since the Page Experience Update (2021).
                    </CardDescription>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold text-[10px] shrink-0">Google Ranking Factor</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-7">

                {/* LCP */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-neutral-800 block">LCP — Largest Contentful Paint</span>
                      <span className="text-[10px] text-neutral-400 font-medium">Time until the main content is visible to the user</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-base font-black block ${vitalsColor("lcp", lcpMs)}`}>{lcpMs}s</span>
                      <span className={`text-[9px] font-black uppercase ${vitalsColor("lcp", lcpMs)}`}>{vitalsLabel("lcp", lcpMs)}</span>
                    </div>
                  </div>
                  <input type="range" min="0.5" max="6.0" step="0.1" value={lcpMs} disabled={isReadOnly} onChange={e => setLcpMs(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer" />
                  <div className="flex justify-between text-[9px] text-neutral-400 font-bold">
                    <span className="text-emerald-600">Good (&lt;2.5s)</span>
                    <span className="text-amber-500">Needs Work (2.5–4.0s)</span>
                    <span className="text-rose-500">Poor (&gt;4.0s)</span>
                  </div>
                </div>

                {/* CLS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-neutral-800 block">CLS — Cumulative Layout Shift</span>
                      <span className="text-[10px] text-neutral-400 font-medium">Unexpected visual instability as page loads</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-base font-black block ${vitalsColor("cls", clsScore)}`}>{clsScore.toFixed(2)}</span>
                      <span className={`text-[9px] font-black uppercase ${vitalsColor("cls", clsScore)}`}>{vitalsLabel("cls", clsScore)}</span>
                    </div>
                  </div>
                  <input type="range" min="0" max="0.5" step="0.01" value={clsScore} disabled={isReadOnly} onChange={e => setClsScore(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer" />
                  <div className="flex justify-between text-[9px] text-neutral-400 font-bold">
                    <span className="text-emerald-600">Good (&lt;0.1)</span>
                    <span className="text-amber-500">Needs Work (0.1–0.25)</span>
                    <span className="text-rose-500">Poor (&gt;0.25)</span>
                  </div>
                </div>

                {/* FID */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-neutral-800 block">FID — First Input Delay</span>
                      <span className="text-[10px] text-neutral-400 font-medium">Delay before browser responds to first user interaction</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-base font-black block ${vitalsColor("fid", fidMs)}`}>{fidMs}ms</span>
                      <span className={`text-[9px] font-black uppercase ${vitalsColor("fid", fidMs)}`}>{vitalsLabel("fid", fidMs)}</span>
                    </div>
                  </div>
                  <input type="range" min="10" max="500" step="5" value={fidMs} disabled={isReadOnly} onChange={e => setFidMs(parseInt(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer" />
                  <div className="flex justify-between text-[9px] text-neutral-400 font-bold">
                    <span className="text-emerald-600">Good (&lt;100ms)</span>
                    <span className="text-amber-500">Needs Work (100–300ms)</span>
                    <span className="text-rose-500">Poor (&gt;300ms)</span>
                  </div>
                </div>

                {/* Vitals Summary */}
                <div className={`p-4 rounded-xl border text-xs font-semibold leading-relaxed ${
                  lcpMs <= 2.5 && clsScore <= 0.1 && fidMs <= 100
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}>
                  <strong>CWV Status:</strong> {
                    lcpMs <= 2.5 && clsScore <= 0.1 && fidMs <= 100
                      ? "All three Core Web Vitals pass Google's thresholds. Page Experience score is excellent."
                      : "One or more CWV signals are failing Google's thresholds. Optimize your server response time, avoid layout shift from dynamic content, and reduce JavaScript blocking."
                  }
                </div>
              </CardContent>
            </Card>
          )}

          {/* OFF-PAGE */}
          {activeSection === "offpage" && (
            <Card className="border-neutral-200/80 shadow-md bg-white animate-in fade-in duration-200">
              <CardHeader className="border-b border-neutral-100 p-5">
                <CardTitle className="text-sm font-black text-neutral-800 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-500" />
                  Off-Page SEO — Backlink Strategy
                </CardTitle>
                <CardDescription className="text-xs font-medium text-neutral-400">
                  Backlinks from external domains remain one of Google's strongest ranking signals (PageRank).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="backlinkBudget">
                    Monthly Backlink Acquisition Budget ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-bold">$</span>
                    <Input
                      id="backlinkBudget"
                      type="number"
                      value={backlinkBudget}
                      disabled={isReadOnly}
                      onChange={e => setBacklinkBudget(parseInt(e.target.value) || 0)}
                      className="text-xs border-neutral-200 pl-6 h-10 font-semibold text-neutral-800"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-400 font-medium">Higher budget → more outreach → more referring domains</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Target Domain Authority (DA) Tier</label>
                    <span className="text-xs font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded">
                      {backlinkQuality <= 1 ? "Tier 3 — DA 15+" : backlinkQuality <= 3 ? "Tier 2 — DA 40+" : "Tier 1 — DA 80+"}
                    </span>
                  </div>
                  <input type="range" min="1" max="5" value={backlinkQuality} disabled={isReadOnly} onChange={e => setBacklinkQuality(parseInt(e.target.value))}
                    className="w-full accent-cyan-600 cursor-pointer" />
                  <div className="flex justify-between text-[9px] text-neutral-400 font-bold">
                    <span>DA 15+ (Blogs)</span><span>DA 40+ (Media)</span><span>DA 80+ (Forbes/Wikipedia)</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 font-medium">Higher DA links transfer more PageRank authority to your domain.</p>
                </div>

                {/* Backlink Impact Preview */}
                <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 space-y-1.5">
                  <span className="text-[10px] font-black text-cyan-700 uppercase tracking-wider">Estimated Monthly Link Acquisitions</span>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div className="text-center">
                      <span className="text-lg font-black text-cyan-700 block">{Math.round(backlinkBudget / 25)}</span>
                      <span className="text-[9px] text-cyan-600 font-bold">Guest Posts</span>
                    </div>
                    <div className="text-center">
                      <span className="text-lg font-black text-cyan-700 block">{Math.round(backlinkBudget / 12)}</span>
                      <span className="text-[9px] text-cyan-600 font-bold">Niche Edits</span>
                    </div>
                    <div className="text-center">
                      <span className="text-lg font-black text-cyan-700 block">{Math.round(backlinkBudget / 50)}</span>
                      <span className="text-[9px] text-cyan-600 font-bold">PR Links</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── RIGHT: Preview + SERP + Results ── */}
        <div className="lg:col-span-1 space-y-5 text-left">

          {/* Google Search Snippet Preview */}
          <Card className="border border-neutral-200/80 shadow-md bg-white overflow-hidden">
            <CardHeader className="border-b border-neutral-100 p-4 bg-neutral-50/50">
              <CardTitle className="text-xs font-black text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Live SERP Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 font-sans space-y-2 bg-neutral-50/30">
              {/* Simulated rank position badge */}
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`font-black text-[10px] border-none ${
                  serpRank <= 3 ? "bg-emerald-100 text-emerald-700" : serpRank <= 7 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                }`}>
                  Projected Rank: #{serpRank}
                </Badge>
                <span className="text-[9px] text-neutral-400 font-semibold">of 10 on page 1</span>
              </div>

              {/* Competitor snippets above */}
              <div className="space-y-1.5 opacity-60">
                {COMPETITOR_SNIPPETS.slice(0, serpRank > 1 ? Math.min(3, serpRank - 1) : 0).map((c, i) => (
                  <div key={i} className="p-2 rounded-lg border border-neutral-200/60 bg-white/70 text-[10px]">
                    <p className="text-neutral-400 truncate">{c.domain}</p>
                    <p className="text-[#1a0dab] font-medium truncate">{c.title}</p>
                    <p className="text-neutral-500 line-clamp-1">{c.desc}</p>
                  </div>
                ))}
              </div>

              {/* Student's snippet (highlighted) */}
              <div className="p-2.5 rounded-lg border-2 border-indigo-300 bg-white shadow-sm">
                <div className="text-[10px] text-emerald-600 font-black flex items-center gap-1 mb-1">
                  <ChevronUp className="h-3 w-3" /> Your Page
                </div>
                <p className="text-[10px] text-neutral-500 truncate">example.com › {urlSlug}</p>
                <p className="text-sm font-medium text-[#1a0dab] leading-tight line-clamp-2">{metaTitle || "Enter a meta title"}</p>
                <p className="text-[10px] text-[#4d5156] leading-relaxed line-clamp-2 mt-0.5">{metaDescription || "Enter a meta description"}</p>
              </div>

              {serpRank > 1 && COMPETITOR_SNIPPETS[COMPETITOR_SNIPPETS.length - 1] && (
                <div className="p-2 rounded-lg border border-neutral-200/60 bg-white/70 text-[10px] opacity-50">
                  <p className="text-neutral-400">growthsuite.com</p>
                  <p className="text-[#1a0dab] font-medium truncate">Marketing Suite Trusted by 50,000 Teams</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Buttons block */}
          <div className="flex flex-col gap-2 w-full">
            <Button
              onClick={handleRunAudit}
              disabled={simLoading}
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700 font-black text-xs h-11 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md"
            >
              <Play className="h-4 w-4 fill-white" />
              {simLoading ? "Crawling Page Nodes..." : "Run Full SEO Audit"}
            </Button>
            
            {isSimulationMode && (
              <Button
                onClick={handleSaveAndContinue}
                disabled={isSaving}
                className="w-full bg-slate-900 text-white hover:bg-slate-950 font-black text-xs h-11 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                {getButtonText()}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Audit Grade */}
          <Card className="border-neutral-200/80 shadow-md bg-white overflow-hidden">
            <CardHeader className="border-b border-neutral-100 p-4 bg-neutral-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-black text-neutral-800 uppercase tracking-wider">Audit Results</CardTitle>
                <CardDescription className="text-[10px] font-semibold text-neutral-400">Live — updates as you type</CardDescription>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-black block ${totalScore >= 80 ? "text-emerald-600" : totalScore >= 65 ? "text-amber-500" : "text-rose-500"}`}>
                  {totalScore}%
                </span>
                <span className="text-[9px] font-black uppercase text-neutral-400 block leading-none">Health Rating</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2 max-h-[260px] overflow-y-auto">
              {auditItems.map((item, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border text-[10px] font-bold ${StatusBg(item.status)}`}>
                  <StatusIcon status={item.status} />
                  <span>{item.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Projection Results */}
          {runSuccess && (
            <Card className="border-neutral-200/80 shadow-lg bg-gradient-to-br from-indigo-900 to-slate-950 text-white animate-in fade-in duration-300 relative overflow-hidden">
              <div className="absolute right-0 bottom-0 translate-y-3 translate-x-3 h-24 w-24 bg-indigo-500/10 rounded-full blur-2xl" />
              <CardHeader className="p-5 pb-3">
                <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Projected 30-Day Outcomes</span>
                <CardTitle className="text-sm font-black text-white mt-1">Simulated Rank Performance</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                    <span className="text-[9px] font-black text-neutral-400 uppercase block">Organic Traffic</span>
                    <span className="text-base font-black text-white block mt-1">{projectedTraffic.toLocaleString()} clicks/mo</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                    <span className="text-[9px] font-black text-neutral-400 uppercase block">Conversions</span>
                    <span className="text-base font-black text-emerald-400 block mt-1">{projectedConversions}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                    <span className="text-[9px] font-black text-neutral-400 uppercase block">SERP Position</span>
                    <span className="text-base font-black text-amber-400 block mt-1">#{serpRank} on Google</span>
                  </div>
                  <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                    <span className="text-[9px] font-black text-neutral-400 uppercase block">Difficulty</span>
                    <span className="text-base font-black text-white block mt-1">{difficulty.label}</span>
                  </div>
                </div>
                <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                  <span className="text-[9px] font-black text-neutral-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Terminal className="h-3 w-3 text-indigo-400" />
                    Crawl Analysis
                  </span>
                  <p className="text-[10px] text-neutral-300 font-medium leading-relaxed mt-1">
                    {totalScore >= 80
                      ? "Strong optimization signals detected. Expect consistent organic impressions and stable rank momentum within 60–90 days."
                      : totalScore >= 60
                        ? "Moderate signals detected. Address yellow audit items to improve rank from current position."
                        : "Multiple ranking blockers found. Fix red audit items immediately to prevent indexing penalties."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
export default SeoSimulationPage
