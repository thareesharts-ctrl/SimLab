import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Share2, Play, ArrowLeft, Sparkles, Eye, RefreshCw, Heart, MessageCircle,
  Send, Bookmark, AlertTriangle, Users, Zap, BarChart3,
  Smartphone, ShoppingCart, MousePointerClick, Megaphone, Globe, Activity,
  ArrowRight
} from "lucide-react"
import { Link, useNavigate, useLocation } from "react-router"
import { useMetaAdsStore, type MetaObjective, type AudienceType } from "@/stores/metaAdsStore"
import { useSimulationStore } from "@/stores/simulationStore"
import { useAuthStore } from "@/stores/authStore"
import { normalizeRole } from "@/lib/normalizeRole"
import { SimulationProgressTracker } from "@/components/simulation/SimulationProgressTracker"
import { toast } from "sonner"
import api from "@/lib/api"

// ─── Meta Campaign Objectives (6 real Meta objectives) ─────────────────────
const META_OBJECTIVES = [
  {
    key: "awareness", label: "Awareness", icon: Megaphone, color: "text-violet-600", bg: "bg-violet-50 border-violet-200",
    desc: "Maximize your ad reach and brand recall among your target audience",
    events: ["Reach", "Brand Recall Lift", "Video Thru-Plays"],
    optimizeFor: "Reach",
  },
  {
    key: "traffic", label: "Traffic", icon: MousePointerClick, color: "text-amber-600", bg: "bg-amber-50 border-amber-200",
    desc: "Send people to a destination: website, app, Facebook, Instagram, WhatsApp",
    events: ["Link Clicks", "Landing Page Views", "Messenger Opens"],
    optimizeFor: "Link Clicks",
  },
  {
    key: "engagement", label: "Engagement", icon: Heart, color: "text-pink-600", bg: "bg-pink-50 border-pink-200",
    desc: "Get more post reactions, comments, shares, event responses, or page follows",
    events: ["Post Engagement", "Video Views", "Page Likes", "Event Responses"],
    optimizeFor: "Post Engagement",
  },
  {
    key: "leads", label: "Leads", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200",
    desc: "Collect leads using Instant Forms, Messenger, Instagram or website",
    events: ["Instant Form Submits", "Messenger Leads", "Calls"],
    optimizeFor: "Leads",
  },
  {
    key: "app_promotion", label: "App Promotion", icon: Smartphone, color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-200",
    desc: "Find new users or re-engage existing users for your mobile app",
    events: ["App Installs", "App Events", "In-App Purchases"],
    optimizeFor: "App Installs",
  },
  {
    key: "sales", label: "Sales", icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200",
    desc: "Find people likely to purchase your product or service online",
    events: ["Purchases", "Add to Cart", "Checkout Initiated"],
    optimizeFor: "Purchases",
  },
]

// ─── Placements ──────────────────────────────────────────────────────────────
const PLACEMENTS = [
  { id: "fb_feed", label: "Facebook Feed", platform: "Facebook", icon: "📘" },
  { id: "ig_feed", label: "Instagram Feed", platform: "Instagram", icon: "📷" },
  { id: "ig_stories", label: "Instagram Stories", platform: "Instagram", icon: "🎥" },
  { id: "ig_reels", label: "Instagram Reels", platform: "Instagram", icon: "🎬" },
  { id: "fb_stories", label: "Facebook Stories", platform: "Facebook", icon: "📖" },
  { id: "messenger", label: "Messenger Inbox", platform: "Messenger", icon: "💬" },
  { id: "audience_network", label: "Audience Network", platform: "Partners", icon: "🌐" },
]

export function MetaAdsSimulationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isSimulationMode = location.pathname.startsWith("/simulation")

  const metaAdsStore = useMetaAdsStore()
  const { activeSimulation, saveDecisions } = useSimulationStore()
  const { user } = useAuthStore()

  const isReadOnly = normalizeRole(user?.role) === 'SUPER_ADMIN' || activeSimulation?.status === 'LOCKED' || activeSimulation?.status === 'COMPLETED'
  const [isSaving, setIsSaving] = useState(false)

  const [activeStep, setActiveStep] = useState<"campaign" | "adset" | "creative" | "review">("campaign")

  // ── CAMPAIGN LEVEL ────────────────────────────────────────────────────────
  const [campaignName, setCampaignName] = useState("Meta-Leads-Conversions")
  const [objective, setObjective] = useState("leads")
  const [budgetType, setBudgetType] = useState<"daily" | "lifetime">("daily")
  const [campaignBudget, setCampaignBudget] = useState(800)
  const [advantagePlus, setAdvantagePlus] = useState(false)  // Advantage+ Campaign

  // ── AD SET LEVEL ──────────────────────────────────────────────────────────
  const [adSetName, setAdSetName] = useState("Adset-Marketing-Professionals")
  const [ageMin, setAgeMin] = useState(21)
  const [ageMax, setAgeMax] = useState(45)
  const [targetGender, setTargetGender] = useState("all")
  const [interestKeywords, setInterestKeywords] = useState("online education, business development, digital marketing")
  const [behaviors, setBehaviors] = useState("Engaged shoppers, Small business owners")
  const [audienceType, setAudienceType] = useState<"core" | "custom" | "lookalike">("core")
  const [lookalikePct, setLookalikePct] = useState(1)
  const [frequencyCap, setFrequencyCap] = useState(3)
  const [selectedPlacements, setSelectedPlacements] = useState<string[]>(["fb_feed", "ig_feed"])

  // ── AD LEVEL (Creative A) ─────────────────────────────────────────────────
  const [adName, setAdName] = useState("Ad-Creative-Alpha")
  const [ctaButton, setCtaButton] = useState("Learn More")
  const [primaryText, setPrimaryText] = useState("🚀 Accelerate your marketing analytics training! SimpLab lets you run realistic campaign simulations for Google Ads, Meta Paid Social, and On-Page SEO. Tweak parameters and view dynamic auction calculations instantly.")
  const [adHeadline, setAdHeadline] = useState("SimpLab Marketing Simulator")
  const [adMediaStyle, setAdMediaStyle] = useState("from-indigo-600 via-purple-600 to-pink-500")
  const [previewPlatform, setPreviewPlatform] = useState<"facebook" | "instagram">("facebook")

  // ── AD LEVEL (Creative B — A/B Test) ──────────────────────────────────────
  const [abTestEnabled, setAbTestEnabled] = useState(false)
  const [adNameB, setAdNameB] = useState("Ad-Creative-Beta")
  const [primaryTextB, setPrimaryTextB] = useState("📊 Learn real digital marketing skills through simulation. No wasted ad spend — just hands-on practice with SEO, Google Ads, and Meta campaigns.")
  const [adHeadlineB, setAdHeadlineB] = useState("Learn Marketing by Doing")
  const [adMediaStyleB, setAdMediaStyleB] = useState("from-emerald-500 via-teal-500 to-cyan-600")

  // ── Results ───────────────────────────────────────────────────────────────
  const [simLoading, setSimLoading] = useState(false)
  const [adResults, setAdResults] = useState<any>(null)
  const [activeCreativeTab, setActiveCreativeTab] = useState<"A" | "B">("A")

  // Load from store on mount in simulation mode
  useEffect(() => {
    if (isSimulationMode) {
      if (metaAdsStore.campaignName) setCampaignName(metaAdsStore.campaignName)
      if (metaAdsStore.objective) setObjective(metaAdsStore.objective)
      if (metaAdsStore.dailyBudget) setCampaignBudget(metaAdsStore.dailyBudget)
      
      // Placements:
      const pl = metaAdsStore.placements
      const selectedPl: string[] = []
      if (pl.feed) { selectedPl.push("fb_feed"); selectedPl.push("ig_feed") }
      if (pl.stories) { selectedPl.push("fb_stories"); selectedPl.push("ig_stories") }
      if (pl.reels) selectedPl.push("ig_reels")
      if (pl.audienceNetwork) selectedPl.push("audience_network")
      if (pl.messenger) selectedPl.push("messenger")
      if (selectedPl.length > 0) setSelectedPlacements(selectedPl)
      
      // Creatives:
      if (metaAdsStore.creatives && metaAdsStore.creatives.length > 0) {
        const creative = metaAdsStore.creatives[0]
        if (creative.headline) setAdHeadline(creative.headline)
        if (creative.primaryText) setPrimaryText(creative.primaryText)
        if (creative.callToAction) setCtaButton(creative.callToAction)
      }

      // Audiences:
      if (metaAdsStore.audiences && metaAdsStore.audiences.length > 0) {
        const primaryAud = metaAdsStore.audiences.find(a => a.selected) || metaAdsStore.audiences[0]
        if (primaryAud.name) setInterestKeywords(primaryAud.name)
        if (primaryAud.description) setBehaviors(primaryAud.description)
        if (primaryAud.type) setAudienceType(primaryAud.type)
      }
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

  const handleSaveAndContinue = async () => {
    setIsSaving(true)
    try {
      if (isReadOnly) {
        navigate("/simulation/results")
        return
      }

      useMetaAdsStore.setState({
        campaignName,
        objective: objective as MetaObjective,
        dailyBudget: budgetType === "daily" ? campaignBudget : Math.round(campaignBudget / 30),
        totalBudget: budgetType === "lifetime" ? campaignBudget : campaignBudget * 30,
        creatives: [{
          id: "cr1",
          type: "image",
          headline: adHeadline,
          primaryText: primaryText,
          callToAction: ctaButton,
          mediaQuality: 80
        }],
        audiences: [{
          name: interestKeywords,
          selected: true,
          size: 10,
          type: audienceType as AudienceType,
          description: behaviors
        }],
        placements: {
          feed: selectedPlacements.includes("fb_feed") || selectedPlacements.includes("ig_feed"),
          stories: selectedPlacements.includes("fb_stories") || selectedPlacements.includes("ig_stories"),
          reels: selectedPlacements.includes("ig_reels"),
          marketplace: false,
          rightColumn: false,
          audienceNetwork: selectedPlacements.includes("audience_network"),
          messenger: selectedPlacements.includes("messenger"),
        }
      })

      await saveDecisions()
      
      const { advanceSimulation } = useSimulationStore.getState()
      await advanceSimulation()
      toast.success("Decisions submitted and locked!")
      navigate("/simulation/results")
    } catch (error) {
      console.error(error)
      toast.error("Failed to save decisions.")
    } finally {
      setIsSaving(false)
    }
  }

  const checkPolicyViolation = () => {
    const text = [
      primaryText,
      adHeadline,
      abTestEnabled ? primaryTextB : "",
      abTestEnabled ? adHeadlineB : ""
    ].filter(Boolean).join(" ").toLowerCase()
    const prohibitedWords = ['guaranteed returns', 'cryptocurrency cash', 'double your money', 'miracle cure', 'replica brand', 'buy votes', 'cheat', 'hack', 'illegal']
    return prohibitedWords.filter(word => text.includes(word))
  }

  const togglePlacement = (placement: string) => {
    if (selectedPlacements.includes(placement)) {
      if (selectedPlacements.length > 1) setSelectedPlacements(selectedPlacements.filter(p => p !== placement))
    } else {
      setSelectedPlacements([...selectedPlacements, placement])
    }
  }

  const objectiveConfig = META_OBJECTIVES.find(o => o.key === objective)!

  const handlePublishSocialCampaign = () => {
    setSimLoading(true)
    setAdResults(null)
    setTimeout(() => {
      const placementsCount = selectedPlacements.length || 1

      // Creative Score A
      let creativeScoreA = 4
      if (primaryText.length > 80) creativeScoreA += 2
      if (adHeadline.length > 15) creativeScoreA += 2
      if (primaryText.includes("🚀") || primaryText.includes("!")) creativeScoreA += 1
      if (selectedPlacements.includes("ig_stories") && selectedPlacements.includes("ig_reels")) creativeScoreA += 1
      creativeScoreA = Math.min(10, creativeScoreA)

      // Creative Score B
      let creativeScoreB = 4
      if (abTestEnabled) {
        if (primaryTextB.length > 80) creativeScoreB += 2
        if (adHeadlineB.length > 15) creativeScoreB += 2
        if (primaryTextB.includes("📊") || primaryTextB.includes("!")) creativeScoreB += 1
        creativeScoreB = Math.min(10, creativeScoreB)
      }

      const spent = campaignBudget * 0.97

      // Audience reach estimation
      const ageRange = ageMax - ageMin
      const audienceMultiplier = audienceType === "core" ? 1.0 : audienceType === "lookalike" ? (lookalikePct <= 2 ? 1.3 : 0.9) : 0.7
      const genderMultiplier = targetGender === "all" ? 1.0 : 0.55

      const estimatedAudienceMin = Math.round(2000000 * audienceMultiplier * genderMultiplier * (1 - (ageRange > 30 ? 0.1 : 0)))
      const estimatedAudienceMax = Math.round(6000000 * audienceMultiplier * genderMultiplier)

      // Core metrics A
      const baseImpressions = spent * 100 * (creativeScoreA / 5) * placementsCount
      const impressions = Math.round(baseImpressions)
      const ctr = parseFloat(((creativeScoreA * 0.52) + (placementsCount * 0.38)).toFixed(2))
      const clicks = Math.round(impressions * (ctr / 100))
      const frequency = parseFloat((impressions / (estimatedAudienceMin / 10)).toFixed(2))

      // Conversion rate by objective
      let convMultiplier = 0.032
      if (objective === "sales") convMultiplier = 0.055
      if (objective === "leads") convMultiplier = 0.048
      if (objective === "engagement") convMultiplier = 0.12
      if (objective === "awareness") convMultiplier = 0.002

      const targetingPenalty = ageRange > 35 ? 0.92 : 1.05
      const conversions = Math.round(clicks * convMultiplier * targetingPenalty)
      const cpa = conversions > 0 ? parseFloat((spent / conversions).toFixed(2)) : 0

      const cpm = parseFloat(((spent / impressions) * 1000).toFixed(2))
      const cpc = clicks > 0 ? parseFloat((spent / clicks).toFixed(2)) : 0

      // A/B comparison
      const impressionsB = abTestEnabled ? Math.round(baseImpressions * (creativeScoreB / creativeScoreA)) : 0
      const clicksB = abTestEnabled ? Math.round(impressionsB * ((creativeScoreB * 0.52 + placementsCount * 0.38) / 100)) : 0
      const conversionsB = abTestEnabled ? Math.round(clicksB * convMultiplier * targetingPenalty * 0.95) : 0
      const cpaB = conversionsB > 0 ? parseFloat((spent / 2 / conversionsB).toFixed(2)) : 0

      // Learning phase
      const isInLearning = conversions < 50
      const learningProgress = Math.min(100, Math.round((conversions / 50) * 100))

      // Frequency warning
      const frequencyWarning = frequency > 3.5

      setAdResults({
        impressions, clicks, ctr, cpm, cpc, spent, conversions, cpa, frequency,
        creativeScoreA, creativeScoreB, impressionsB, clicksB, conversionsB, cpaB,
        isInLearning, learningProgress, frequencyWarning,
        estimatedAudienceMin, estimatedAudienceMax,
        winnerCreative: abTestEnabled ? (conversions >= conversionsB ? "A" : "B") : "A"
      })
      setSimLoading(false)
    }, 1800)
  }

  const steps = [
    { key: "campaign", label: "1. Campaign" },
    { key: "adset", label: "2. Ad Set" },
    { key: "creative", label: "3. Creative" },
    { key: "review", label: "4. Review" },
  ] as const

  const CTA_OPTIONS = ["Learn More", "Shop Now", "Sign Up", "Download", "Get Quote", "Contact Us", "Book Now", "Apply Now"]
  const MEDIA_STYLES = [
    { val: "from-indigo-600 via-purple-600 to-pink-500", label: "Indigo → Pink" },
    { val: "from-emerald-500 via-teal-500 to-cyan-600", label: "Green → Cyan" },
    { val: "from-amber-500 via-orange-500 to-rose-500", label: "Amber → Rose" },
    { val: "from-slate-700 via-slate-800 to-slate-900", label: "Dark Slate" },
  ]

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">

      {isSimulationMode && <SimulationProgressTracker />}

      {/* Nav Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Link to={isSimulationMode ? "/simulation/google-ads" : "/instructor"} className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {isSimulationMode ? "Back to Google Ads Decisions" : "Back to Portal Dashboard"}
        </Link>
        <span className="text-xs font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          {isSimulationMode ? `Meta Ads Decisions (Round ${activeSimulation?.currentRound || 1})` : "Meta Ads Manager Simulator"}
        </span>
      </div>

      {/* Page Title */}
      <div className="space-y-2 text-left">
        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 flex items-center gap-2.5">
          <Share2 className="h-7 w-7 text-blue-600" />
          Meta Ads Manager — Campaign Builder
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 font-semibold max-w-3xl leading-relaxed">
          Simulate the real Meta Ads Manager 3-level structure: Campaign → Ad Set → Ad. Choose objectives, define audience targeting, configure placements, and write creative copy. The simulator computes reach, CPM, CPA, frequency, and A/B test insights.
        </p>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Campaign Builder */}
        <div className="lg:col-span-2 space-y-5">

          {/* Steps */}
          <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200/50 overflow-x-auto gap-0.5">
            {steps.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveStep(s.key)}
                className={`flex-1 py-2.5 px-3 text-xs font-black rounded-lg transition-all whitespace-nowrap ${
                  activeStep === s.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <Card className="border border-neutral-200/80 shadow-md bg-white text-left">
            <CardContent className="p-6">

              {/* ── STEP 1: CAMPAIGN ── */}
              {activeStep === "campaign" && (
                <div className="space-y-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h3 className="font-black text-sm text-neutral-800">Campaign Objective</h3>
                    <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">
                      The objective tells Meta what result to optimize for. This determines the pixel events, ad formats, and bidding methods available to you.
                    </p>
                  </div>

                  {/* Objective Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {META_OBJECTIVES.map(obj => {
                      const ObjIcon = obj.icon
                      const isSelected = objective === obj.key
                      return (
                        <button
                          key={obj.key}
                          onClick={() => {
                            if (isReadOnly) return
                            setObjective(obj.key)
                          }}
                          className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border-2 text-left transition-all ${
                            isSelected ? `${obj.bg} border-current ${obj.color}` : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                          }`}
                        >
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-white/80" : "bg-neutral-100"}`}>
                            <ObjIcon className={`h-4 w-4 ${isSelected ? obj.color : "text-neutral-500"}`} />
                          </div>
                          <div>
                            <p className={`text-xs font-black ${isSelected ? obj.color : "text-neutral-700"}`}>{obj.label}</p>
                            <p className="text-[9px] text-neutral-400 font-medium leading-snug mt-0.5 line-clamp-2">{obj.desc}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {objectiveConfig && (
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3.5">
                      <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Optimization Events Available for "{objectiveConfig.label}"</span>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {objectiveConfig.events.map(e => (
                          <Badge key={e} className="bg-white border border-neutral-200 text-neutral-700 font-bold text-[10px]">{e}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Campaign details */}
                  <div className="space-y-4 pt-2 border-t border-neutral-100">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Campaign Name</label>
                      <Input value={campaignName} disabled={isReadOnly} onChange={e => setCampaignName(e.target.value)} className="text-xs border-neutral-200 h-10 font-semibold" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Budget Type</label>
                        <select value={budgetType} disabled={isReadOnly} onChange={e => setBudgetType(e.target.value as any)} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-xs bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option value="daily">Daily Budget (CBO)</option>
                          <option value="lifetime">Lifetime Budget</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">
                          {budgetType === "daily" ? "Daily Budget (USD)" : "Total Lifetime Budget (USD)"}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-bold">$</span>
                          <Input type="number" value={campaignBudget} disabled={isReadOnly} onChange={e => setCampaignBudget(parseInt(e.target.value) || 0)} className="text-xs border-neutral-200 pl-6 h-10 font-semibold" />
                        </div>
                      </div>
                    </div>

                    {/* Advantage+ toggle */}
                    <div className="flex items-start justify-between p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                      <div>
                        <p className="text-xs font-black text-blue-700">Advantage+ Campaign Budget</p>
                        <p className="text-[10px] text-blue-600 font-medium mt-0.5">Meta automatically distributes budget across ad sets to find the best-performing audiences using AI</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                        <input type="checkbox" checked={advantagePlus} disabled={isReadOnly} onChange={e => setAdvantagePlus(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-neutral-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 2: AD SET ── */}
              {activeStep === "adset" && (
                <div className="space-y-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h3 className="font-black text-sm text-neutral-800">Ad Set — Targeting & Placement</h3>
                    <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Define who sees your ad and where. Optimizing for: <strong>{objectiveConfig.optimizeFor}</strong></p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Ad Set Name</label>
                    <Input value={adSetName} disabled={isReadOnly} onChange={e => setAdSetName(e.target.value)} className="text-xs border-neutral-200 h-9 font-semibold" />
                  </div>

                  {/* Audience Type */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Audience Type</span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "core", label: "Core Audience", desc: "Target by demographics & interests" },
                        { key: "custom", label: "Custom Audience", desc: "Upload customer list / pixel data" },
                        { key: "lookalike", label: "Lookalike Audience", desc: "Find similar users to your customers" },
                      ].map(a => (
                        <button
                          key={a.key}
                          onClick={() => {
                            if (isReadOnly) return
                            setAudienceType(a.key as any)
                          }}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            audienceType === a.key ? "border-blue-500 bg-blue-50" : "border-neutral-200 hover:border-neutral-300"
                          }`}
                        >
                          <p className={`text-[10px] font-black ${audienceType === a.key ? "text-blue-700" : "text-neutral-700"}`}>{a.label}</p>
                          <p className="text-[9px] text-neutral-400 font-medium mt-0.5 leading-tight">{a.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Core Audience Settings */}
                  {audienceType === "core" && (
                    <div className="space-y-4 p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                      <div className="grid grid-cols-3 gap-3 items-end">
                        <div className="col-span-2 space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Age Range</label>
                          <div className="flex items-center gap-2">
                            <Input type="number" min={18} max={65} value={ageMin} disabled={isReadOnly} onChange={e => setAgeMin(parseInt(e.target.value))} className="text-xs border-neutral-200 h-9 font-semibold" />
                            <span className="text-xs text-neutral-400 font-bold">—</span>
                            <Input type="number" min={18} max={65} value={ageMax} disabled={isReadOnly} onChange={e => setAgeMax(parseInt(e.target.value))} className="text-xs border-neutral-200 h-9 font-semibold" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Gender</label>
                          <select value={targetGender} disabled={isReadOnly} onChange={e => setTargetGender(e.target.value)} className="w-full h-9 px-2 border border-neutral-200 rounded-lg text-xs bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="all">All Genders</option>
                            <option value="male">Men</option>
                            <option value="female">Women</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Interests</label>
                        <Input value={interestKeywords} disabled={isReadOnly} onChange={e => setInterestKeywords(e.target.value)} className="text-xs border-neutral-200 h-9 font-semibold" placeholder="e.g. digital marketing, entrepreneurship" />
                        <p className="text-[9px] text-neutral-400 font-medium">Comma-separated interest categories. Meta matches these to user activity signals.</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Behaviors</label>
                        <Input value={behaviors} disabled={isReadOnly} onChange={e => setBehaviors(e.target.value)} className="text-xs border-neutral-200 h-9 font-semibold" placeholder="e.g. Engaged shoppers, Frequent travelers" />
                      </div>
                    </div>
                  )}

                  {/* Lookalike Settings */}
                  {audienceType === "lookalike" && (
                    <div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <p className="text-[10px] font-bold text-blue-700">Lookalike audiences find new people who share similar characteristics to your source audience (e.g. customers, website visitors).</p>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Lookalike Size</label>
                          <span className="text-[10px] font-black text-blue-700">Top {lookalikePct}% of country population</span>
                        </div>
                        <input type="range" min={1} max={10} value={lookalikePct} disabled={isReadOnly} onChange={e => setLookalikePct(parseInt(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
                        <div className="flex justify-between text-[9px] text-neutral-400 font-bold">
                          <span className="text-emerald-600">1% (More Similar)</span>
                          <span className="text-amber-500">5% (Balanced)</span>
                          <span className="text-rose-500">10% (Broader)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custom Audience */}
                  {audienceType === "custom" && (
                    <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                      <p className="text-xs font-black text-neutral-700">Custom Audience Source (Simulated)</p>
                      {["Customer email list (CRM upload)", "Website visitors — last 30 days", "Instagram profile engagers", "Video viewers (75%+ completion)"].map(s => (
                        <label key={s} className="flex items-center gap-2.5 cursor-pointer">
                          <input type="radio" name="customSource" disabled={isReadOnly} className="text-blue-600" defaultChecked={s.includes("email")} />
                          <span className="text-[10px] font-semibold text-neutral-700">{s}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Placements */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Placements</span>
                      <Badge className={`border-none text-[9px] font-black ${advantagePlus ? "bg-blue-50 text-blue-700" : "bg-neutral-100 text-neutral-600"}`}>
                        {advantagePlus ? "Advantage+ (Auto)" : "Manual"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {PLACEMENTS.map(p => (
                        <label key={p.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          selectedPlacements.includes(p.id) ? "border-blue-400 bg-blue-50" : "border-neutral-200 hover:border-neutral-300"
                        } ${advantagePlus ? "opacity-50 cursor-not-allowed" : ""}`}>
                          <input
                            type="checkbox"
                            checked={advantagePlus || selectedPlacements.includes(p.id)}
                            disabled={isReadOnly || advantagePlus}
                            onChange={() => !advantagePlus && togglePlacement(p.id)}
                            className="rounded border-neutral-300 text-blue-600 h-3.5 w-3.5 shrink-0"
                          />
                          <span className="text-[10px]">{p.icon}</span>
                          <div>
                            <span className="text-[10px] font-bold text-neutral-700 block">{p.label}</span>
                            <span className="text-[9px] text-neutral-400">{p.platform}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Frequency Cap */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Frequency Cap (impressions per person)</label>
                      <span className="text-[10px] font-black text-neutral-700">{frequencyCap}x per week</span>
                    </div>
                    <input type="range" min={1} max={7} value={frequencyCap} disabled={isReadOnly} onChange={e => setFrequencyCap(parseInt(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
                    <div className="flex justify-between text-[9px] text-neutral-400 font-bold">
                      <span className="text-emerald-600">1x (Low reach)</span>
                      <span className="text-amber-500">3–4x (Optimal)</span>
                      <span className="text-rose-500">7x (Ad fatigue risk)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 3: CREATIVE ── */}
              {activeStep === "creative" && (
                <div className="space-y-5">
                  <div className="border-b border-neutral-100 pb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-sm text-neutral-800">Ad Creative</h3>
                      <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Design your ad copy and media. Enable A/B testing to compare two creative variants.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-neutral-500">A/B Test</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={abTestEnabled} disabled={isReadOnly} onChange={e => setAbTestEnabled(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-neutral-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                      </label>
                    </div>
                  </div>

                  {checkPolicyViolation().length > 0 && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-2.5">
                      <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black text-rose-900">⚠️ Ad Policy Violation Warning</strong>
                        Your ad copy contains prohibited words: <span className="font-mono bg-rose-100/50 px-1 py-0.2 rounded font-bold text-rose-950">"{checkPolicyViolation().join(", ")}"</span>. 
                        Submitting this copy will trigger a blocking policy violation on the backend and disqualify you from certification.
                      </div>
                    </div>
                  )}

                  {/* Creative Tabs */}
                  {abTestEnabled && (
                    <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200/50">
                      {(["A", "B"] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveCreativeTab(tab)}
                          className={`flex-1 py-2 text-xs font-black rounded-md transition-all ${
                            activeCreativeTab === tab ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                          }`}
                        >
                          Creative {tab} {tab === "A" ? "(Control)" : "(Variant)"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Creative A */}
                  {(!abTestEnabled || activeCreativeTab === "A") && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Ad Name</label>
                        <Input value={adName} disabled={isReadOnly} onChange={e => setAdName(e.target.value)} className="text-xs border-neutral-200 h-9 font-semibold" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Primary Text</label>
                          <span className={`text-[9px] font-bold ${primaryText.length > 120 ? "text-amber-500" : "text-neutral-400"}`}>{primaryText.length} chars</span>
                        </div>
                        <textarea rows={4} value={primaryText} disabled={isReadOnly} onChange={e => setPrimaryText(e.target.value)}
                          className="w-full text-xs p-3 border border-neutral-200 rounded-lg font-medium text-neutral-800 bg-white leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Headline</label>
                            <span className={`text-[9px] font-bold ${adHeadline.length > 27 ? "text-amber-500" : "text-neutral-400"}`}>{adHeadline.length}/27</span>
                          </div>
                          <Input maxLength={27} value={adHeadline} disabled={isReadOnly} onChange={e => setAdHeadline(e.target.value)} className="text-xs border-neutral-200 h-9 font-semibold" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Call to Action</label>
                          <select value={ctaButton} disabled={isReadOnly} onChange={e => setCtaButton(e.target.value)} className="w-full h-9 px-3 border border-neutral-200 rounded-lg text-xs bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500">
                            {CTA_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Ad Background / Media Style</label>
                        <div className="flex flex-wrap gap-2">
                          {MEDIA_STYLES.map(s => (
                            <button key={s.val} onClick={() => !isReadOnly && setAdMediaStyle(s.val)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${adMediaStyle === s.val ? "border-blue-500 bg-blue-50 text-blue-700" : "border-neutral-200 hover:border-neutral-300"}`}>
                              <span className={`h-3 w-3 rounded-full bg-gradient-to-r ${s.val}`} />
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Creative B */}
                  {abTestEnabled && activeCreativeTab === "B" && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Ad Name (Variant B)</label>
                        <Input value={adNameB} disabled={isReadOnly} onChange={e => setAdNameB(e.target.value)} className="text-xs border-neutral-200 h-9 font-semibold" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Primary Text (Variant B)</label>
                          <span className={`text-[9px] font-bold ${primaryTextB.length > 120 ? "text-amber-500" : "text-neutral-400"}`}>{primaryTextB.length} chars</span>
                        </div>
                        <textarea rows={4} value={primaryTextB} disabled={isReadOnly} onChange={e => setPrimaryTextB(e.target.value)}
                          className="w-full text-xs p-3 border border-neutral-200 rounded-lg font-medium text-neutral-800 bg-white leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Headline (Variant B)</label>
                          <Input maxLength={27} value={adHeadlineB} disabled={isReadOnly} onChange={e => setAdHeadlineB(e.target.value)} className="text-xs border-neutral-200 h-9 font-semibold" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Background Style</label>
                          <select value={adMediaStyleB} disabled={isReadOnly} onChange={e => setAdMediaStyleB(e.target.value)} className="w-full h-9 px-3 border border-neutral-200 rounded-lg text-xs bg-white font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500">
                            {MEDIA_STYLES.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 4: REVIEW ── */}
              {activeStep === "review" && (
                <div className="space-y-4">
                  <div className="border-b border-neutral-100 pb-3">
                    <h3 className="font-black text-sm text-neutral-800">Campaign Review</h3>
                    <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Review your setup before publishing the simulation.</p>
                  </div>
                  {[
                    { label: "Campaign", items: [
                      { k: "Name", v: campaignName },
                      { k: "Objective", v: objectiveConfig?.label },
                      { k: "Budget", v: `$${campaignBudget} (${budgetType})` },
                      { k: "Advantage+", v: advantagePlus ? "Enabled" : "Disabled" },
                    ]},
                    { label: "Ad Set", items: [
                      { k: "Audience", v: audienceType === "core" ? "Core Audience" : audienceType === "lookalike" ? `Lookalike ${lookalikePct}%` : "Custom Audience" },
                      { k: "Age Range", v: `${ageMin}–${ageMax}` },
                      { k: "Gender", v: targetGender === "all" ? "All" : targetGender === "male" ? "Men" : "Women" },
                      { k: "Placements", v: `${selectedPlacements.length} selected` },
                      { k: "Frequency Cap", v: `${frequencyCap}x/week` },
                    ]},
                    { label: "Creative", items: [
                      { k: "Ad Name", v: adName },
                      { k: "Headline", v: adHeadline },
                      { k: "CTA Button", v: ctaButton },
                      { k: "A/B Test", v: abTestEnabled ? `Enabled (A vs B)` : "Disabled" },
                    ]},
                  ].map(section => (
                    <div key={section.label} className="bg-neutral-50 rounded-xl border border-neutral-100 p-4">
                      <p className="text-[10px] font-black text-neutral-500 uppercase tracking-wider mb-2">{section.label}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {section.items.map(item => (
                          <div key={item.k} className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-neutral-400">{item.k}:</span>
                            <span className="text-[10px] font-black text-neutral-700 truncate">{item.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Preview + Results */}
        <div className="lg:col-span-1 space-y-5">

          {/* Platform Toggle */}
          <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200/50">
            <button
              onClick={() => setPreviewPlatform("facebook")}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${previewPlatform === "facebook" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}
            >
              📘 Facebook
            </button>
            <button
              onClick={() => setPreviewPlatform("instagram")}
              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${previewPlatform === "instagram" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"}`}
            >
              📷 Instagram
            </button>
          </div>

          {/* Ad Preview */}
          <Card className="border border-neutral-200/80 shadow-md bg-white overflow-hidden text-left">
            <CardHeader className="border-b border-neutral-100 p-4 bg-neutral-50/50">
              <span className="text-xs font-black text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Live Ad Preview — Creative {activeCreativeTab}
              </span>
            </CardHeader>
            <CardContent className="p-4 bg-neutral-50/30 flex justify-center">
              {previewPlatform === "facebook" ? (
                <div className="w-full max-w-xs bg-white border border-neutral-200 rounded-xl shadow-sm font-sans overflow-hidden">
                  {/* FB Post Header */}
                  <div className="flex items-center gap-2.5 p-3 border-b border-neutral-100">
                    <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black shrink-0">SL</div>
                    <div>
                      <p className="text-xs font-bold text-neutral-900">SimpLab Platform</p>
                      <p className="text-[9px] text-neutral-400 flex items-center gap-1">Sponsored · <Globe className="h-2.5 w-2.5" /></p>
                    </div>
                    <span className="ml-auto text-neutral-400 text-lg">···</span>
                  </div>
                  {/* Primary text */}
                  <div className="px-3 py-2">
                    <p className="text-[11px] text-neutral-800 leading-relaxed line-clamp-3">
                      {activeCreativeTab === "A" || !abTestEnabled ? primaryText : primaryTextB}
                    </p>
                  </div>
                  {/* Media */}
                  <div className={`h-36 bg-gradient-to-tr ${activeCreativeTab === "A" || !abTestEnabled ? adMediaStyle : adMediaStyleB} flex items-end p-3`}>
                    <div>
                      <p className="text-[10px] text-white/80 font-semibold">example.com</p>
                      <p className="text-sm font-black text-white leading-tight">
                        {activeCreativeTab === "A" || !abTestEnabled ? adHeadline : adHeadlineB}
                      </p>
                    </div>
                  </div>
                  {/* CTA */}
                  <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-100 bg-neutral-50">
                    <span className="text-[10px] text-neutral-400 font-semibold">example.com</span>
                    <button className="bg-neutral-200 text-neutral-700 text-[10px] font-black px-3 py-1.5 rounded-lg">{ctaButton}</button>
                  </div>
                  {/* Reactions bar */}
                  <div className="flex items-center gap-3 px-3 py-2 text-neutral-500">
                    <button className="flex items-center gap-1 text-[10px] font-semibold hover:text-blue-600"><Heart className="h-3.5 w-3.5" /> Like</button>
                    <button className="flex items-center gap-1 text-[10px] font-semibold hover:text-blue-600"><MessageCircle className="h-3.5 w-3.5" /> Comment</button>
                    <button className="flex items-center gap-1 text-[10px] font-semibold hover:text-blue-600"><Send className="h-3.5 w-3.5" /> Share</button>
                  </div>
                </div>
              ) : (
                // Instagram Preview
                <div className="w-full max-w-xs bg-white border border-neutral-200 rounded-xl shadow-sm font-sans overflow-hidden">
                  <div className="flex items-center gap-2 p-3 border-b border-neutral-100">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 p-0.5 shrink-0">
                      <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                        <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-pink-500 to-amber-400 flex items-center justify-center text-white text-[8px] font-black">SL</div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-neutral-900">simplab_platform</p>
                      <p className="text-[9px] text-neutral-400">Sponsored</p>
                    </div>
                    <span className="text-neutral-400 text-sm">···</span>
                  </div>
                  {/* Media */}
                  <div className={`h-48 bg-gradient-to-tr ${activeCreativeTab === "A" || !abTestEnabled ? adMediaStyle : adMediaStyleB} flex items-center justify-center`}>
                    <p className="text-white font-black text-sm px-4 text-center">
                      {activeCreativeTab === "A" || !abTestEnabled ? adHeadline : adHeadlineB}
                    </p>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-3 px-3 pt-2 pb-1">
                    <Heart className="h-5 w-5 text-neutral-800 cursor-pointer" />
                    <MessageCircle className="h-5 w-5 text-neutral-800 cursor-pointer" />
                    <Send className="h-5 w-5 text-neutral-800 cursor-pointer" />
                    <Bookmark className="h-5 w-5 text-neutral-800 cursor-pointer ml-auto" />
                  </div>
                  <div className="px-3 pb-3">
                    <p className="text-[10px] text-neutral-700 leading-relaxed line-clamp-2 mt-1">{activeCreativeTab === "A" || !abTestEnabled ? primaryText : primaryTextB}</p>
                    <button className="w-full mt-2 bg-blue-600 text-white text-[10px] font-black py-2 rounded-lg">{ctaButton}</button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Publish Button */}
          <div className="flex flex-col gap-2 w-full">
            <Button
              onClick={handlePublishSocialCampaign}
              disabled={simLoading}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 font-black text-xs h-11 rounded-xl flex items-center justify-center gap-1.5 shadow-md"
            >
              <Play className="h-4 w-4 fill-white" />
              {simLoading ? "Running Meta Delivery Simulation..." : "Publish Campaign to Delivery"}
            </Button>
            
            {isSimulationMode && (
              <Button
                onClick={handleSaveAndContinue}
                disabled={isSaving}
                className="w-full bg-slate-900 text-white hover:bg-slate-950 font-black text-xs h-11 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                {isSaving ? "Saving Decisions..." : isReadOnly ? "Next: Results" : "Submit & Lock Decisions"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Results */}
          {simLoading && (
            <div className="h-48 border border-neutral-200/80 rounded-2xl flex flex-col items-center justify-center bg-neutral-50/50 shadow-md">
              <RefreshCw className="h-7 w-7 text-blue-600 animate-spin mb-3" />
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Meta Delivery Engine Processing...</p>
            </div>
          )}

          {!simLoading && adResults && (
            <div className="space-y-4 animate-in fade-in duration-300">

              {/* Learning Phase */}
              {adResults.isInLearning && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-black text-amber-700">Learning Phase Active</span>
                  </div>
                  <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                    Meta's algorithm needs 50 optimization events to exit the learning phase and stabilize delivery. Currently at <strong>{adResults.conversions}</strong> events ({adResults.learningProgress}% complete). Avoid editing the ad set during this period.
                  </p>
                  <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${adResults.learningProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Frequency Warning */}
              {adResults.frequencyWarning && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-rose-700">Creative Fatigue Warning</p>
                    <p className="text-[10px] text-rose-600 font-medium">Ad frequency of {adResults.frequency}x per person exceeds 3.5. Users are seeing your ad too often — CTR will drop. Expand audience or refresh creative.</p>
                  </div>
                </div>
              )}

              {/* Audience Reach Estimator */}
              <Card className="border border-neutral-200/80 shadow-md bg-white text-left">
                <CardContent className="p-4 space-y-2">
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Estimated Audience Size
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-black text-neutral-800">{adResults.estimatedAudienceMin.toLocaleString()}</span>
                    <span className="text-xs text-neutral-400 font-semibold">–</span>
                    <span className="text-base font-black text-neutral-800">{adResults.estimatedAudienceMax.toLocaleString()}</span>
                  </div>
                  <p className="text-[9px] text-neutral-400 font-medium">Potential reach based on your audience targeting configuration</p>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (adResults.estimatedAudienceMin / 10000000) * 100)}%` }} />
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Metrics */}
              <Card className="border border-neutral-200/80 shadow-md bg-white text-left">
                <CardHeader className="border-b border-neutral-100 p-4 bg-neutral-50/50">
                  <CardTitle className="text-xs font-black text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                    Delivery Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { label: "Impressions", val: adResults.impressions.toLocaleString(), color: "text-neutral-800" },
                      { label: "Clicks", val: adResults.clicks.toLocaleString(), color: "text-neutral-800" },
                      { label: "CTR", val: `${adResults.ctr}%`, color: "text-blue-600" },
                      { label: "Conversions", val: adResults.conversions.toString(), color: "text-emerald-600" },
                      { label: "CPM", val: `$${adResults.cpm}`, color: "text-neutral-800" },
                      { label: "CPA", val: `$${adResults.cpa}`, color: "text-neutral-800" },
                      { label: "CPC", val: `$${adResults.cpc}`, color: "text-neutral-800" },
                      { label: "Frequency", val: `${adResults.frequency}x`, color: adResults.frequencyWarning ? "text-rose-500" : "text-neutral-800" },
                    ].map(m => (
                      <div key={m.label} className="p-2.5 rounded-lg border border-neutral-100 bg-neutral-50/50">
                        <span className="text-[9px] font-black text-neutral-400 uppercase block">{m.label}</span>
                        <span className={`text-sm font-black ${m.color} block mt-0.5`}>{m.val}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-neutral-900 text-white p-3 rounded-xl space-y-1">
                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-wide block">Total Budget Spent</span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-black text-white">${adResults.spent.toLocaleString()}</span>
                      <Badge className={`border-none text-[9px] font-black ${adResults.isInLearning ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                        {adResults.isInLearning ? "Learning" : "Active"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* A/B Test Results */}
              {abTestEnabled && (
                <Card className="border border-neutral-200/80 shadow-md bg-white text-left">
                  <CardHeader className="border-b border-neutral-100 p-4 bg-neutral-50/50">
                    <CardTitle className="text-xs font-black text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-indigo-600" />
                      A/B Test Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { name: "Creative A (Control)", impressions: adResults.impressions, clicks: adResults.clicks, conversions: adResults.conversions, cpa: adResults.cpa },
                        { name: "Creative B (Variant)", impressions: adResults.impressionsB, clicks: adResults.clicksB, conversions: adResults.conversionsB, cpa: adResults.cpaB },
                      ].map((c, i) => (
                        <div key={i} className={`p-3 rounded-xl border-2 space-y-1.5 ${adResults.winnerCreative === (i === 0 ? "A" : "B") ? "border-emerald-400 bg-emerald-50/30" : "border-neutral-200"}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-neutral-700">{c.name}</span>
                            {adResults.winnerCreative === (i === 0 ? "A" : "B") && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-none text-[9px] font-black">🏆 Winner</Badge>
                            )}
                          </div>
                          <p className="text-[9px] text-neutral-400"><strong className="text-neutral-700">{c.impressions.toLocaleString()}</strong> impr.</p>
                          <p className="text-[9px] text-neutral-400"><strong className="text-neutral-700">{c.clicks.toLocaleString()}</strong> clicks</p>
                          <p className="text-[9px] text-neutral-400"><strong className="text-emerald-600">{c.conversions}</strong> conversions</p>
                          <p className="text-[9px] text-neutral-400">CPA: <strong className="text-neutral-700">${c.cpa}</strong></p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-neutral-500 font-medium">
                      Based on results, <strong>Creative {adResults.winnerCreative}</strong> is outperforming. Pause the losing variant and scale the winner's budget.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default MetaAdsSimulationPage
