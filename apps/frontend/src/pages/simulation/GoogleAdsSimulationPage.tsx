import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Target, Play, ArrowLeft, Sparkles, Eye, RefreshCw, AlertTriangle,
  Monitor, Smartphone, HelpCircle, Plus, Trash2, BarChart3,
  TrendingUp, ShoppingCart, Users, MousePointerClick, Megaphone,
  ArrowRight
} from "lucide-react"
import { Link, useNavigate, useLocation } from "react-router"
import { useGoogleAdsStore, type MatchType } from "@/stores/googleAdsStore"
import { useSimulationStore } from "@/stores/simulationStore"
import { useAuthStore } from "@/stores/authStore"
import { normalizeRole } from "@/lib/normalizeRole"
import { SimulationProgressTracker } from "@/components/simulation/SimulationProgressTracker"
import { toast } from "sonner"
import api from "@/lib/api"

// ─── Campaign Objective Config ─────────────────────────────────────────────
const OBJECTIVES = [
  {
    key: "sales", label: "Sales", icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200",
    desc: "Drive online, in-app, by phone, or in-store sales",
    allowedBidding: ["maximize_conversions", "target_roas", "manual_cpc"],
    optimizationEvent: "Purchase / Checkout",
  },
  {
    key: "leads", label: "Leads", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200",
    desc: "Get sign-ups, subscriptions, and contact form fills",
    allowedBidding: ["maximize_conversions", "target_cpa", "manual_cpc"],
    optimizationEvent: "Form Submission / Sign Up",
  },
  {
    key: "traffic", label: "Website Traffic", icon: MousePointerClick, color: "text-amber-600", bg: "bg-amber-50 border-amber-200",
    desc: "Drive relevant users to visit your website",
    allowedBidding: ["maximize_clicks", "target_cpa", "manual_cpc"],
    optimizationEvent: "Landing Page View",
  },
  {
    key: "awareness", label: "Brand Awareness", icon: Megaphone, color: "text-violet-600", bg: "bg-violet-50 border-violet-200",
    desc: "Reach a broad audience to build brand recognition",
    allowedBidding: ["target_impression_share", "maximize_clicks"],
    optimizationEvent: "Impressions / Reach",
  },
]

const BIDDING_OPTIONS: Record<string, { label: string; desc: string }> = {
  maximize_conversions: { label: "Maximize Conversions", desc: "Smart Bidding — gets the most conversions within your budget" },
  target_roas: { label: "Target ROAS", desc: "Smart Bidding — sets bids to maximize conversion value at a target return" },
  target_cpa: { label: "Target CPA", desc: "Smart Bidding — sets bids to get max conversions at your target cost per action" },
  maximize_clicks: { label: "Maximize Clicks", desc: "Automated — sets bids to get the most clicks within your daily budget" },
  target_impression_share: { label: "Target Impression Share", desc: "Automated — targets a specific % of impression share on SERPs" },
  manual_cpc: { label: "Manual CPC", desc: "Full control — you set the maximum CPC bid per keyword manually" },
}

// ─── Keyword Volume Hints ──────────────────────────────────────────────────
const KW_VOLUME_HINTS: Record<string, { vol: string; comp: string; cpc: string }> = {
  "marketing platform": { vol: "10K–100K/mo", comp: "High", cpc: "$2.40" },
  "digital marketing": { vol: "100K–1M/mo", comp: "High", cpc: "$3.10" },
  "seo tools": { vol: "10K–100K/mo", comp: "Medium", cpc: "$1.85" },
  "google ads": { vol: "10K–100K/mo", comp: "High", cpc: "$4.20" },
  "ppc marketing": { vol: "1K–10K/mo", comp: "Medium", cpc: "$2.95" },
  "marketing analytics": { vol: "1K–10K/mo", comp: "Low", cpc: "$1.40" },
  "business analytics": { vol: "10K–100K/mo", comp: "Medium", cpc: "$2.20" },
  "advertising platform": { vol: "1K–10K/mo", comp: "High", cpc: "$3.80" },
}

const getKwHint = (kw: string) => KW_VOLUME_HINTS[kw.trim().toLowerCase()] ?? { vol: "Unknown", comp: "—", cpc: "—" }

export function GoogleAdsSimulationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isSimulationMode = location.pathname.startsWith("/simulation")

  const googleAdsStore = useGoogleAdsStore()
  const { activeSimulation, saveDecisions } = useSimulationStore()
  const { user } = useAuthStore()

  const isReadOnly = normalizeRole(user?.role) === 'SUPER_ADMIN' || activeSimulation?.status === 'LOCKED' || activeSimulation?.status === 'COMPLETED'
  const [isSaving, setIsSaving] = useState(false)

  const [activeStep, setActiveStep] = useState<"objective" | "settings" | "budget" | "keywords" | "creatives" | "extensions">("objective")

  // STEP 1: OBJECTIVE
  const [campaignObjective, setCampaignObjective] = useState("leads")

  // STEP 2: CAMPAIGN SETTINGS
  const [campaignName, setCampaignName] = useState("Search-Leads-Platform")
  const [searchNetwork, setSearchNetwork] = useState(true)
  const [displayNetwork, setDisplayNetwork] = useState(false)
  const [targetLocation, setTargetLocation] = useState("United States, Canada")
  const [targetLanguage, setTargetLanguage] = useState("English")

  // STEP 3: BUDGET & BIDDING
  const [dailyBudget, setDailyBudget] = useState(50)
  const [biddingStrategy, setBiddingStrategy] = useState("maximize_conversions")
  const [maxCpcBid, setMaxCpcBid] = useState(1.85)
  const [targetCpa, setTargetCpa] = useState(25)

  // STEP 4: KEYWORDS
  const [keywordsText, setKeywordsText] = useState(
    `marketing platform\n"marketing tools"\n[best advertising platform]\nbusiness analytics`
  )

  // STEP 5: AD CREATIVES
  const [finalUrl, setFinalUrl] = useState("https://example.com/sim")
  const [path1, setPath1] = useState("solutions")
  const [path2, setPath2] = useState("marketing")
  const [headline1, setHeadline1] = useState("SimpLab Marketing Platform")
  const [headline2, setHeadline2] = useState("Master Google Ads Auction")
  const [headline3, setHeadline3] = useState("Test Campaigns Live")
  const [description1, setDescription1] = useState("Renovate your advertising strategies using realistic simulation sandboxes. Create, test, and publish PPC campaigns.")
  const [description2, setDescription2] = useState("Learn cost-per-click bidding, quality score mechanics, and conversion funnel analytics under daily budgets.")

  // STEP 6: AD EXTENSIONS
  const [sitelinks, setSitelinks] = useState([
    { title: "Free Trial", desc: "Start your 14-day trial", url: "/trial" },
    { title: "Pricing", desc: "See our plans", url: "/pricing" },
    { title: "Case Studies", desc: "See real results", url: "/cases" },
    { title: "Contact Us", desc: "Talk to our team", url: "/contact" },
  ])
  const [callouts, setCallouts] = useState(["No Setup Fees", "24/7 Support", "Cancel Anytime", "GDPR Compliant"])
  const [callExtension, setCallExtension] = useState("+1 (800) 000-0000")
  const [hasCallExtension, setHasCallExtension] = useState(true)
  
  const [structuredSnippetHeader, setStructuredSnippetHeader] = useState("Services")
  const [structuredSnippetValues, setStructuredSnippetValues] = useState(["Marketing Consulting", "SEO Audit", "PPC Setup"])
  const [promotionItem, setPromotionItem] = useState("Summer Special")
  const [promotionDiscount, setPromotionDiscount] = useState("20% Off")
  const [promotionCode, setPromotionCode] = useState("SIMLAB20")
  const [hasPromotion, setHasPromotion] = useState(false)
  const [leadFormTitle, setLeadFormTitle] = useState("Get a Free Consultation")
  const [hasLeadForm, setHasLeadForm] = useState(false)

  // Load from store on mount in simulation mode
  useEffect(() => {
    if (isSimulationMode) {
      if (googleAdsStore.campaignName) setCampaignName(googleAdsStore.campaignName)
      if (googleAdsStore.objective) setCampaignObjective(googleAdsStore.objective.toLowerCase())
      if (googleAdsStore.biddingStrategy) {
        const strategyKey = googleStoreStrategyToLocal(googleAdsStore.biddingStrategy)
        setBiddingStrategy(strategyKey)
      }
      if (googleAdsStore.dailyBudget) setDailyBudget(googleAdsStore.dailyBudget)
      
      // Keywords sync:
      if (googleAdsStore.selectedKeywords && googleAdsStore.selectedKeywords.length > 0) {
        const text = googleAdsStore.selectedKeywords.map(k => {
          if (k.matchType === "exact") return `[${k.keyword}]`
          if (k.matchType === "phrase") return `"${k.keyword}"`
          return k.keyword
        }).join("\n")
        setKeywordsText(text)
      }
      
      // Ad copy sync:
      if (googleAdsStore.adCopies && googleAdsStore.adCopies.length > 0) {
        const copy = googleAdsStore.adCopies[0]
        if (copy.headline1) setHeadline1(copy.headline1)
        if (copy.headline2) setHeadline2(copy.headline2)
        if (copy.headline3) setHeadline3(copy.headline3)
        if (copy.description1) setDescription1(copy.description1)
        if (copy.description2) setDescription2(copy.description2)
      }

      // Extensions sync:
      if (googleAdsStore.sitelinks && googleAdsStore.sitelinks.length > 0) {
        setSitelinks(googleAdsStore.sitelinks.map(s => ({ title: s.title, desc: "", url: s.url })))
      }
      if (googleAdsStore.callouts && googleAdsStore.callouts.length > 0) {
        setCallouts(googleAdsStore.callouts)
      }
      const ext = (googleAdsStore as any).extensions || {}
      if (ext.structuredSnippets) {
        setStructuredSnippetHeader(ext.structuredSnippetHeader || "Services")
        setStructuredSnippetValues(ext.structuredSnippets)
      }
      if (ext.promotion) {
        setHasPromotion(true)
        setPromotionItem(ext.promotion.item || "")
        setPromotionDiscount(ext.promotion.discount || "")
        setPromotionCode(ext.promotion.code || "")
      }
      if (ext.leadForm) {
        setHasLeadForm(true)
        setLeadFormTitle(ext.leadForm.title || "")
      }
      if (ext.callExtension) {
        setHasCallExtension(true)
        setCallExtension(ext.callExtension)
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

  const googleStoreStrategyToLocal = (strategy: string) => {
    const s = strategy.toLowerCase()
    if (s.includes("maximize conversions")) return "maximize_conversions"
    if (s.includes("roas")) return "target_roas"
    if (s.includes("cpa")) return "target_cpa"
    if (s.includes("clicks")) return "maximize_clicks"
    if (s.includes("impression")) return "target_impression_share"
    return "manual_cpc"
  }

  const allowed = activeSimulation?.allowedPlatforms || ["SEO", "GOOGLE_ADS", "META_ADS"]

  const getNextStepPath = () => {
    if (allowed.includes("META_ADS")) return "/simulation/meta-ads"
    return "/simulation/results"
  }

  const getButtonText = () => {
    const nextPath = getNextStepPath()
    if (isSaving) return "Saving Decisions..."
    if (nextPath === "/simulation/results") {
      return isReadOnly ? "Next: Results" : "Submit & Lock Decisions"
    } else {
      return isReadOnly ? "Next: Meta Ads" : "Save & Continue"
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

      // Client-side Policy check
      const policyRes = checkPolicyViolation()
      const hasHardViolations = policyRes.hard.length > 0 || policyRes.urlIssues.some(ui => ui.includes('start with http'))
      
      if (hasHardViolations) {
        toast.error(`Hard policy violations detected: ${[...policyRes.hard, ...policyRes.urlIssues.filter(ui => ui.includes('start with http'))].join(', ')}. Hard violations will block certification!`, {
          duration: 8000
        });
      } else if (policyRes.soft.length > 0 || policyRes.urlIssues.length > 0) {
        toast.warning(`Soft policy warnings: ${[...policyRes.soft, ...policyRes.urlIssues].join(', ')}. These may reduce Quality Score or CTR.`, {
          duration: 6000
        });
      }

      const { list } = getKeywordsAnalysis()
      const parsedKeywords = list.map(kw => {
        let matchType: MatchType = "broad"
        let keyword = kw
        if (kw.startsWith("[") && kw.endsWith("]")) {
          matchType = "exact"
          keyword = kw.slice(1, -1)
        } else if (kw.startsWith('"') && kw.endsWith('"')) {
          matchType = "phrase"
          keyword = kw.slice(1, -1)
        }
        return { keyword, bid: maxCpcBid, matchType }
      })

      useGoogleAdsStore.setState({
        campaignName,
        objective: campaignObjective === "sales" ? "Sales" : campaignObjective === "leads" ? "Leads" : campaignObjective === "traffic" ? "Website Traffic" : "Brand Awareness",
        biddingStrategy: biddingStrategy === "maximize_conversions" ? "Maximize Conversions" : biddingStrategy === "target_roas" ? "Target ROAS" : biddingStrategy === "target_cpa" ? "Target CPA" : biddingStrategy === "maximize_clicks" ? "Maximize Clicks" : biddingStrategy === "target_impression_share" ? "Target Impression Share" : "Manual CPC",
        dailyBudget,
        totalBudget: dailyBudget * 30,
        selectedKeywords: parsedKeywords,
        adCopies: [{
          headline1,
          headline2,
          headline3,
          description1,
          description2,
          strength: "excellent"
        }],
        locations: targetLocation.split(",").map(l => ({ name: l.trim(), selected: true })),
        devices: { desktop: searchNetwork, mobile: true, tablet: displayNetwork },
        sitelinks: sitelinks.map(s => ({ title: s.title, url: s.url })),
        callouts,
        extensions: {
          sitelinks: sitelinks.map(s => ({ title: s.title, url: s.url })),
          callouts,
          structuredSnippets: structuredSnippetValues,
          structuredSnippetHeader,
          promotion: hasPromotion ? { item: promotionItem, discount: promotionDiscount, code: promotionCode } : null,
          leadForm: hasLeadForm ? { title: leadFormTitle } : null,
          callExtension: hasCallExtension ? callExtension : null
        }
      } as any)

      await saveDecisions()
      
      if (nextPath === "/simulation/results") {
        const { advanceSimulation } = useSimulationStore.getState()
        await advanceSimulation()
        toast.success("Decisions submitted and locked!")
      } else {
        toast.success("Google Ads decisions saved successfully!")
      }
      navigate(nextPath)
    } catch (error) {
      console.error(error)
      toast.error("Failed to save decisions.")
    } finally {
      setIsSaving(false)
    }
  }

  // Preview
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile")
  const [simLoading, setSimLoading] = useState(false)
  const [adResults, setAdResults] = useState<any>(null)

  const objectiveConfig = OBJECTIVES.find(o => o.key === campaignObjective)!

  const getKeywordsAnalysis = () => {
    const list = keywordsText.split("\n").map(k => k.trim()).filter(Boolean)
    let broadCount = 0, phraseCount = 0, exactCount = 0
    list.forEach(kw => {
      if (kw.startsWith("[") && kw.endsWith("]")) exactCount++
      else if (kw.startsWith('"') && kw.endsWith('"')) phraseCount++
      else broadCount++
    })
    return { list, total: list.length, broadCount, phraseCount, exactCount }
  }

  const checkPolicyViolation = () => {
    const text = [headline1, headline2, headline3, description1, description2].join(" ").toLowerCase()
    
    // Prohibited words (Hard)
    const prohibitedWords = [
      'guaranteed returns', 'cryptocurrency cash', 'double your money', 
      'miracle cure', 'replica brand', 'buy votes', 'cheat', 'hack', 'illegal'
    ]
    // Unrealistic guarantees (Hard)
    const misleadingKeywords = ['100% success', 'make millions overnight', 'lose 10kg in 2 days']
    // Exaggerated claims (Soft)
    const softViolations = ['best in world', 'cheapest ever']

    const hardFound = [...prohibitedWords, ...misleadingKeywords].filter(word => text.includes(word))
    const softFound = softViolations.filter(word => text.includes(word))

    // CAPS check
    const words = [headline1, headline2, headline3, description1, description2].join(" ").split(/\s+/)
    const capsWords = words.filter(w => w.length > 3 && w === w.toUpperCase() && /^[A-Z]+$/.test(w))

    const urlIssues: string[] = []
    if (!finalUrl || !finalUrl.startsWith('http')) {
      urlIssues.push('Destination URL must start with http/https')
    }
    if (finalUrl && finalUrl.includes('mismatch')) {
      urlIssues.push('Landing page URL does not match final destination')
    }

    return {
      hard: hardFound,
      soft: [...softFound, ...capsWords],
      urlIssues
    }
  }

  const handlePublishCampaign = () => {
    setSimLoading(true)
    setAdResults(null)
    setTimeout(() => {
      const { broadCount, phraseCount, exactCount } = getKeywordsAnalysis()
      const totalKeywords = (broadCount + phraseCount + exactCount) || 1

      // Quality Score — 3 factors (Expected CTR, Ad Relevance, Landing Page Exp)
      let expectedCtrScore = 5
      if (exactCount > 0) expectedCtrScore += 2
      if (phraseCount > 0) expectedCtrScore += 1
      expectedCtrScore = Math.min(10, expectedCtrScore)

      let adRelevanceScore = 4
      if (headline1.length > 20) adRelevanceScore += 2
      if (description1.toLowerCase().includes("marketing") || description1.toLowerCase().includes("platform")) adRelevanceScore += 2
      if (headline2.length > 15) adRelevanceScore += 1
      adRelevanceScore = Math.min(10, adRelevanceScore)

      let landingPageScore = 5
      if (finalUrl.startsWith("https")) landingPageScore += 2
      if (path1 && path2) landingPageScore += 2
      landingPageScore = Math.min(10, landingPageScore)

      const qualityScore = Math.round((expectedCtrScore + adRelevanceScore + landingPageScore) / 3)

      // Extensions boost
      const extensionBonus = (sitelinks.length >= 4 ? 0.12 : 0) + (callouts.length >= 3 ? 0.08 : 0) + (hasCallExtension ? 0.06 : 0)

      const weightedCtr = ((broadCount * 2.8) + (phraseCount * 5.2) + (exactCount * 9.8)) / totalKeywords
      const baseCtr = weightedCtr + (qualityScore * 0.35) + extensionBonus * 10
      const ctr = parseFloat(Math.min(25, baseCtr).toFixed(2))

      const avgCpc = parseFloat(Math.max(0.10, maxCpcBid * (0.85 - (qualityScore * 0.03))).toFixed(2))
      const totalBudgetLimit = dailyBudget * 30
      const bidRatio = maxCpcBid / 1.20
      const spent = Math.min(totalBudgetLimit, totalBudgetLimit * (bidRatio > 1 ? 0.98 : bidRatio * 0.9))
      const clicks = Math.round(spent / avgCpc)
      const impressions = Math.round(clicks / (ctr / 100))
      const convRate = (exactCount * 0.08 + phraseCount * 0.045 + broadCount * 0.02) / totalKeywords
      const conversions = Math.round(clicks * (convRate + (qualityScore * 0.005)))
      const cpa = conversions > 0 ? parseFloat((spent / conversions).toFixed(2)) : 0
      const revenuePerConversion = campaignObjective === "sales" ? 120 : campaignObjective === "leads" ? 75 : 45
      const projectedRevenue = conversions * revenuePerConversion
      const roi = spent > 0 ? parseFloat((projectedRevenue / spent).toFixed(2)) : 0

      // Auction Insights
      const auctionData = [
        { competitor: "topcompetitor.com", impressionShare: Math.round(52 + qualityScore * 1.5) + "%", overlapRate: "67%", posAbove: "31%", topImpr: "88%" },
        { competitor: "adsbrand.io", impressionShare: Math.round(38 + qualityScore) + "%", overlapRate: "45%", posAbove: "18%", topImpr: "72%" },
        { competitor: "growthads.co", impressionShare: Math.round(29 + qualityScore * 0.8) + "%", overlapRate: "38%", posAbove: "12%", topImpr: "61%" },
      ]

      const qsLabel = (s: number) => s >= 7 ? "Above Average" : s >= 5 ? "Average" : "Below Average"
      const qsColor = (s: number) => s >= 7 ? "text-emerald-600" : s >= 5 ? "text-amber-500" : "text-rose-500"

      setAdResults({
        impressions, clicks, ctr, spent, avgCpc, conversions, cpa, roi, qualityScore,
        expectedCtrScore, adRelevanceScore, landingPageScore, qsLabel, qsColor,
        auctionData, extensionBonus
      })
      setSimLoading(false)
    }, 1800)
  }

  const { broadCount, phraseCount, exactCount, list: kwList } = getKeywordsAnalysis()
  const activeObjective = OBJECTIVES.find(o => o.key === campaignObjective)!

  const steps = [
    { key: "objective", label: "1. Objective" },
    { key: "settings", label: "2. Settings" },
    { key: "budget", label: "3. Budget & Bid" },
    { key: "keywords", label: "4. Keywords" },
    { key: "creatives", label: "5. Ad Copy" },
    { key: "extensions", label: "6. Extensions" },
  ] as const

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">

      {isSimulationMode && <SimulationProgressTracker />}

      {/* Nav Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Link to={isSimulationMode ? "/simulation/seo" : "/instructor"} className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {isSimulationMode ? "Back to SEO Decisions" : "Back to Portal Dashboard"}
        </Link>
        <span className="text-xs font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
          {isSimulationMode ? `Google Ads Decisions (Round ${activeSimulation?.currentRound || 1})` : "Google Ads Campaign Simulator"}
        </span>
      </div>

      {/* Page Title */}
      <div className="space-y-2 text-left">
        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 flex items-center gap-2.5">
          <Target className="h-7 w-7 text-emerald-600" />
          Google Ads Campaign Builder
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 font-semibold max-w-3xl leading-relaxed">
          Build a complete Google Search campaign — choose your objective, set budgets, add keyword match types, write responsive ad copy, and configure extensions. The simulator computes Quality Score, CPC, conversions, and Auction Insights.
        </p>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Campaign Wizard */}
        <div className="lg:col-span-2 space-y-5">

          {/* Step Tab Header */}
          <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200/50 overflow-x-auto gap-0.5">
            {steps.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveStep(s.key)}
                className={`flex-1 py-2 px-2 text-[11px] font-black rounded-lg transition-all whitespace-nowrap ${
                  activeStep === s.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <Card className="border border-neutral-200/80 shadow-md bg-white text-left">
            <CardContent className="p-6">

              {/* ── STEP 1: OBJECTIVE ── */}
              {activeStep === "objective" && (
                <div className="space-y-4">
                  <div className="border-b border-neutral-100 pb-3">
                    <h3 className="font-black text-sm text-neutral-800">Select Your Campaign Objective</h3>
                    <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">
                      Your objective defines what Google's algorithm will optimize for. It also determines which bidding strategies are available.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {OBJECTIVES.map(obj => {
                      const ObjIcon = obj.icon
                      const isSelected = campaignObjective === obj.key
                      return (
                        <button
                          key={obj.key}
                          onClick={() => {
                            if (isReadOnly) return
                            setCampaignObjective(obj.key)
                            setBiddingStrategy(obj.allowedBidding[0])
                          }}
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                            isSelected ? `${obj.bg} border-current ${obj.color}` : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                          }`}
                        >
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-white/80" : "bg-neutral-100"}`}>
                            <ObjIcon className={`h-5 w-5 ${isSelected ? obj.color : "text-neutral-500"}`} />
                          </div>
                          <div>
                            <p className={`text-sm font-black ${isSelected ? obj.color : "text-neutral-800"}`}>{obj.label}</p>
                            <p className="text-[10px] text-neutral-500 font-medium leading-snug mt-0.5">{obj.desc}</p>
                            {isSelected && (
                              <p className="text-[9px] font-black mt-1 uppercase tracking-wide opacity-80">
                                Optimization: {obj.optimizationEvent}
                              </p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3.5">
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Available Bidding Strategies for "{activeObjective.label}"</span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {activeObjective.allowedBidding.map(b => (
                        <Badge key={b} className="bg-white border border-neutral-200 text-neutral-700 font-bold text-[10px]">
                          {BIDDING_OPTIONS[b]?.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 2: SETTINGS ── */}
              {activeStep === "settings" && (
                <div className="space-y-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h3 className="font-black text-sm text-neutral-800">General Campaign Settings</h3>
                    <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Configure networks, location targeting, and language.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="campName">Campaign Name</label>
                    <Input id="campName" value={campaignName} disabled={isReadOnly} onChange={e => setCampaignName(e.target.value)} className="text-xs border-neutral-200 h-10 font-semibold" />
                  </div>
                  <div className="space-y-2 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Network Targeting</span>
                    <div className="flex flex-col sm:flex-row gap-5 pt-1">
                      {[
                        { label: "Google Search Network", sub: "Ads on google.com and search partner sites", state: searchNetwork, set: setSearchNetwork },
                        { label: "Google Display Network", sub: "Banner ads on 3M+ partner websites and apps", state: displayNetwork, set: setDisplayNetwork },
                      ].map(n => (
                        <label key={n.label} className="flex items-start gap-2.5 cursor-pointer flex-1">
                          <input
                            type="checkbox" checked={n.state} disabled={isReadOnly} onChange={e => n.set(e.target.checked)}
                            className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 mt-0.5 shrink-0"
                          />
                          <div>
                            <span className="text-xs font-bold text-neutral-700 block">{n.label}</span>
                            <span className="text-[10px] text-neutral-400 font-medium">{n.sub}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="loc">Target Locations</label>
                      <Input id="loc" value={targetLocation} disabled={isReadOnly} onChange={e => setTargetLocation(e.target.value)} className="text-xs border-neutral-200 h-10 font-semibold" />
                      <p className="text-[9px] text-neutral-400 font-medium">Comma-separated countries, cities, or regions</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="lang">Language Targeting</label>
                      <Input id="lang" value={targetLanguage} disabled={isReadOnly} onChange={e => setTargetLanguage(e.target.value)} className="text-xs border-neutral-200 h-10 font-semibold" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── STEP 3: BUDGET & BIDDING ── */}
              {activeStep === "budget" && (
                <div className="space-y-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h3 className="font-black text-sm text-neutral-800">Budget & Bidding Strategy</h3>
                    <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Available strategies are constrained by your campaign objective: <strong>{objectiveConfig.label}</strong></p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="dailyBudget">Average Daily Budget (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-bold">$</span>
                        <Input id="dailyBudget" type="number" value={dailyBudget} disabled={isReadOnly} onChange={e => setDailyBudget(parseInt(e.target.value) || 0)} className="text-xs border-neutral-200 pl-6 h-10 font-semibold" />
                      </div>
                      <p className="text-[9px] text-neutral-400 font-medium">Google may spend up to 2× this daily. Monthly cap = {dailyBudget * 30} USD.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Bidding Strategy</label>
                      <select
                        value={biddingStrategy}
                        disabled={isReadOnly}
                        onChange={e => setBiddingStrategy(e.target.value)}
                        className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-xs bg-white font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {objectiveConfig.allowedBidding.map(b => (
                          <option key={b} value={b}>{BIDDING_OPTIONS[b]?.label}</option>
                        ))}
                      </select>
                      <p className="text-[9px] text-neutral-400 font-medium">{BIDDING_OPTIONS[biddingStrategy]?.desc}</p>
                    </div>
                  </div>

                  {biddingStrategy === "manual_cpc" && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="maxBid">Max CPC Bid Limit (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-bold">$</span>
                        <Input id="maxBid" type="number" step="0.05" value={maxCpcBid} disabled={isReadOnly} onChange={e => setMaxCpcBid(parseFloat(e.target.value) || 0)} className="text-xs border-neutral-200 pl-6 h-10 font-semibold" />
                      </div>
                    </div>
                  )}

                  {biddingStrategy === "target_cpa" && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Target CPA (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-bold">$</span>
                        <Input type="number" step="1" value={targetCpa} disabled={isReadOnly} onChange={e => setTargetCpa(parseInt(e.target.value) || 0)} className="text-xs border-neutral-200 pl-6 h-10 font-semibold" />
                      </div>
                      <p className="text-[9px] text-neutral-400 font-medium">Google will optimize bids to get conversions at approx. this cost per action.</p>
                    </div>
                  )}

                  {/* Monthly budget summary */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Daily Budget", value: `$${dailyBudget}` },
                      { label: "Monthly Max", value: `$${(dailyBudget * 30.4).toFixed(0)}` },
                      { label: "30-Day Cap", value: `$${dailyBudget * 30}` },
                    ].map(s => (
                      <div key={s.label} className="bg-neutral-50 border border-neutral-100 rounded-xl p-3 text-center">
                        <span className="text-[9px] font-black text-neutral-400 uppercase block">{s.label}</span>
                        <span className="text-sm font-black text-neutral-800 block mt-1">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP 4: KEYWORDS ── */}
              {activeStep === "keywords" && (
                <div className="space-y-5">
                  <div className="border-b border-neutral-100 pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-sm text-neutral-800">Search Keywords & Match Types</h3>
                      <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Enter one keyword per line. Wrap in "quotes" for phrase match, [brackets] for exact match.</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge className="bg-neutral-100 text-neutral-700 border-none font-bold text-[9px]">{broadCount} Broad</Badge>
                      <Badge className="bg-indigo-50 text-indigo-700 border-none font-bold text-[9px]">{phraseCount} Phrase</Badge>
                      <Badge className="bg-emerald-50 text-emerald-700 border-none font-bold text-[9px]">{exactCount} Exact</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="kwText">
                        Keywords <span className="text-neutral-400 normal-case font-normal">(one per line)</span>
                      </label>
                      <textarea
                        id="kwText"
                        rows={7}
                        value={keywordsText}
                        disabled={isReadOnly}
                        onChange={e => setKeywordsText(e.target.value)}
                        className="w-full text-xs p-3 border border-neutral-200 rounded-lg font-mono text-neutral-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder={`keyword (Broad)\n"keyword phrase" (Phrase)\n[exact keyword] (Exact)`}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-150 space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-black text-neutral-700 uppercase tracking-wider">
                          <HelpCircle className="h-4 w-4 text-neutral-500" />
                          Match Types
                        </div>
                        {[
                          { type: "Broad Match", syntax: "keyword", desc: "Reaches synonyms & related queries. Highest volume, lowest precision." },
                          { type: "Phrase Match", syntax: '"keyword"', desc: "Matches queries containing your phrase in order." },
                          { type: "Exact Match", syntax: "[keyword]", desc: "Only matches this exact query. Highest CTR, lowest volume." },
                        ].map(m => (
                          <div key={m.type}>
                            <div className="flex items-center gap-1.5">
                              <code className="text-[10px] bg-white border border-neutral-200 px-1.5 py-0.5 rounded font-mono text-neutral-600">{m.syntax}</code>
                              <span className="text-[10px] font-black text-neutral-700">{m.type}</span>
                            </div>
                            <p className="text-[9px] text-neutral-400 font-medium mt-0.5 pl-0.5">{m.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Keyword Planner Hints */}
                  {kwList.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Keyword Planner Intelligence
                      </span>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-neutral-50 text-[9px] font-black text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                              <th className="px-3 py-2">Keyword</th>
                              <th className="px-3 py-2">Match Type</th>
                              <th className="px-3 py-2">Avg Monthly Volume</th>
                              <th className="px-3 py-2">Competition</th>
                              <th className="px-3 py-2">Suggested CPC</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-50">
                            {kwList.slice(0, 6).map((kw, i) => {
                              const clean = kw.replace(/["\[\]]/g, "")
                              const hint = getKwHint(clean)
                              const matchType = kw.startsWith("[") ? "Exact" : kw.startsWith('"') ? "Phrase" : "Broad"
                              const compColor = hint.comp === "High" ? "text-rose-500" : hint.comp === "Medium" ? "text-amber-500" : "text-emerald-600"
                              return (
                                <tr key={i} className="hover:bg-neutral-50/50 font-semibold text-neutral-700">
                                  <td className="px-3 py-2 font-mono text-[10px] text-neutral-600">{kw}</td>
                                  <td className="px-3 py-2">
                                    <Badge className={`border-none text-[9px] font-black ${
                                      matchType === "Exact" ? "bg-emerald-50 text-emerald-700" :
                                      matchType === "Phrase" ? "bg-indigo-50 text-indigo-700" :
                                      "bg-neutral-100 text-neutral-600"
                                    }`}>{matchType}</Badge>
                                  </td>
                                  <td className="px-3 py-2 text-[10px]">{hint.vol}</td>
                                  <td className={`px-3 py-2 text-[10px] font-bold ${compColor}`}>{hint.comp}</td>
                                  <td className="px-3 py-2 text-[10px] font-bold text-neutral-800">{hint.cpc}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 5: AD CREATIVES ── */}
              {activeStep === "creatives" && (
                <div className="space-y-4">
                  <div className="border-b border-neutral-100 pb-3">
                    <h3 className="font-black text-sm text-neutral-800">Responsive Search Ad (RSA)</h3>
                    <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">Google automatically tests combinations of your headlines and descriptions to find the best-performing mix.</p>
                  </div>
                  {checkPolicyViolation().hard.length > 0 && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-2.5">
                      <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-black text-rose-900">⚠️ Ad Policy Violation Warning</strong>
                        Your ad copy contains prohibited words: <span className="font-mono bg-rose-100/50 px-1 py-0.2 rounded font-bold text-rose-950">"{checkPolicyViolation().hard.join(", ")}"</span>. 
                        Submitting this copy will trigger a blocking policy violation on the backend and disqualify you from certification.
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="finalUrl">Final URL</label>
                      <Input id="finalUrl" value={finalUrl} disabled={isReadOnly} onChange={e => setFinalUrl(e.target.value)} className="text-xs border-neutral-200 h-9 font-semibold" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Display Path</label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-neutral-400 font-bold whitespace-nowrap">example.com /</span>
                        <Input maxLength={15} value={path1} disabled={isReadOnly} onChange={e => setPath1(e.target.value)} className="text-xs border-neutral-200 h-9 font-semibold flex-1" placeholder="path1" />
                        <span className="text-xs text-neutral-400 font-bold">/</span>
                        <Input maxLength={15} value={path2} disabled={isReadOnly} onChange={e => setPath2(e.target.value)} className="text-xs border-neutral-200 h-9 font-semibold flex-1" placeholder="path2" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: "h1", label: "Headline 1", value: headline1, set: setHeadline1 },
                      { id: "h2", label: "Headline 2", value: headline2, set: setHeadline2 },
                      { id: "h3", label: "Headline 3", value: headline3, set: setHeadline3 },
                    ].map(h => (
                      <div key={h.id} className="space-y-1">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider" htmlFor={h.id}>{h.label}</label>
                          <span className={`text-[9px] font-bold ${h.value.length > 25 ? "text-amber-500" : "text-neutral-400"}`}>{h.value.length}/30</span>
                        </div>
                        <Input id={h.id} maxLength={30} value={h.value} disabled={isReadOnly} onChange={e => h.set(e.target.value)} className="text-xs border-neutral-200 h-9 font-semibold" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: "d1", label: "Description 1", value: description1, set: setDescription1 },
                      { id: "d2", label: "Description 2", value: description2, set: setDescription2 },
                    ].map(d => (
                      <div key={d.id} className="space-y-1">
                        <div className="flex justify-between">
                          <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider" htmlFor={d.id}>{d.label}</label>
                          <span className={`text-[9px] font-bold ${d.value.length > 80 ? "text-amber-500" : "text-neutral-400"}`}>{d.value.length}/90</span>
                        </div>
                        <textarea
                          id={d.id}
                          rows={3}
                          maxLength={90}
                          value={d.value}
                          disabled={isReadOnly}
                          onChange={e => d.set(e.target.value)}
                          className="w-full text-xs p-2.5 border border-neutral-200 rounded-lg font-semibold text-neutral-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP 6: AD EXTENSIONS ── */}
              {activeStep === "extensions" && (
                <div className="space-y-5">
                  <div className="border-b border-neutral-100 pb-3">
                    <h3 className="font-black text-sm text-neutral-800">Ad Extensions</h3>
                    <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">
                      Extensions expand your ad with extra info and increase click-through rates by up to 15%. They also improve your Ad Rank without extra cost.
                    </p>
                  </div>

                  {/* Sitelinks */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-neutral-700">Sitelink Extensions <Badge className="ml-1.5 bg-emerald-50 text-emerald-700 border-none text-[9px] font-black">+CTR Boost</Badge></span>
                      <span className="text-[9px] text-neutral-400 font-semibold">{sitelinks.length}/4 added</span>
                    </div>
                    <div className="space-y-2">
                      {sitelinks.map((sl, i) => (
                        <div key={i} className="flex items-center gap-2 p-2.5 bg-neutral-50 rounded-lg border border-neutral-100">
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <Input value={sl.title} maxLength={25} disabled={isReadOnly} onChange={e => { const n = [...sitelinks]; n[i].title = e.target.value; setSitelinks(n) }} className="text-[10px] h-8 font-semibold" placeholder="Link text (25)" />
                            <Input value={sl.desc} maxLength={35} disabled={isReadOnly} onChange={e => { const n = [...sitelinks]; n[i].desc = e.target.value; setSitelinks(n) }} className="text-[10px] h-8 font-semibold" placeholder="Description (35)" />
                            <Input value={sl.url} disabled={isReadOnly} onChange={e => { const n = [...sitelinks]; n[i].url = e.target.value; setSitelinks(n) }} className="text-[10px] h-8 font-semibold font-mono" placeholder="/url-path" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Callout Extensions */}
                  <div className="space-y-2">
                    <span className="text-xs font-black text-neutral-700">Callout Extensions <Badge className="ml-1.5 bg-indigo-50 text-indigo-700 border-none text-[9px] font-black">+Ad Rank</Badge></span>
                    <div className="flex flex-wrap gap-2">
                      {callouts.map((c, i) => (
                        <div key={i} className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5">
                          <Input
                            value={c}
                            maxLength={25}
                            disabled={isReadOnly}
                            onChange={e => { const n = [...callouts]; n[i] = e.target.value; setCallouts(n) }}
                            className="text-[10px] h-6 border-0 p-0 font-semibold bg-transparent w-24"
                          />
                          {!isReadOnly && (
                            <button onClick={() => setCallouts(callouts.filter((_, j) => j !== i))} className="text-neutral-300 hover:text-rose-500">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      {callouts.length < 8 && !isReadOnly && (
                        <button onClick={() => setCallouts([...callouts, "New Callout"])} className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 hover:text-neutral-900 border border-dashed border-neutral-300 rounded-lg px-2 py-1.5">
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Call Extension */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-neutral-700">Call Extension</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={hasCallExtension} disabled={isReadOnly} onChange={e => setHasCallExtension(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-neutral-200 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                      </label>
                    </div>
                    {hasCallExtension && (
                      <Input value={callExtension} disabled={isReadOnly} onChange={e => setCallExtension(e.target.value)} placeholder="+1 (800) 000-0000" className="text-xs border-neutral-200 h-9 font-semibold max-w-[200px]" />
                    )}
                  </div>

                  {/* Structured Snippets */}
                  <div className="space-y-2 border-t border-neutral-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-neutral-700 font-sans">Structured Snippets <Badge className="ml-1.5 bg-sky-50 text-sky-700 border-none text-[9px] font-black">+Relevance</Badge></span>
                      <span className="text-[9px] text-neutral-400 font-semibold">{structuredSnippetValues.length}/4 added</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select 
                        value={structuredSnippetHeader} 
                        disabled={isReadOnly} 
                        onChange={e => setStructuredSnippetHeader(e.target.value)} 
                        className="text-xs p-1.5 border border-neutral-200 rounded bg-white font-semibold text-neutral-700 focus:outline-none"
                      >
                        <option value="Services">Services</option>
                        <option value="Types">Types</option>
                        <option value="Brands">Brands</option>
                        <option value="Courses">Courses</option>
                        <option value="Destinations">Destinations</option>
                      </select>
                      <div className="flex flex-wrap gap-2 flex-1">
                        {structuredSnippetValues.map((val, i) => (
                          <div key={i} className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded px-2 py-1">
                            <Input
                              value={val}
                              maxLength={25}
                              disabled={isReadOnly}
                              onChange={e => { const n = [...structuredSnippetValues]; n[i] = e.target.value; setStructuredSnippetValues(n) }}
                              className="text-[10px] h-5 border-0 p-0 font-semibold bg-transparent w-20"
                            />
                            {!isReadOnly && (
                              <button onClick={() => setStructuredSnippetValues(structuredSnippetValues.filter((_, j) => j !== i))} className="text-neutral-300 hover:text-rose-500">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                        {structuredSnippetValues.length < 4 && !isReadOnly && (
                          <button onClick={() => setStructuredSnippetValues([...structuredSnippetValues, "New Value"])} className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 hover:text-neutral-900 border border-dashed border-neutral-300 rounded px-2 py-1">
                            <Plus className="h-3 w-3" /> Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Promotion Extension */}
                  <div className="space-y-2 border-t border-neutral-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-neutral-700 font-sans">Promotion Extension</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={hasPromotion} disabled={isReadOnly} onChange={e => setHasPromotion(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-neutral-200 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                      </label>
                    </div>
                    {hasPromotion && (
                      <div className="grid grid-cols-3 gap-2 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                        <div>
                          <label className="text-[9px] font-black text-neutral-500 uppercase tracking-wider">Discount</label>
                          <Input value={promotionDiscount} disabled={isReadOnly} onChange={e => setPromotionDiscount(e.target.value)} placeholder="20% Off" className="text-xs border-neutral-200 h-8 font-semibold" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-neutral-500 uppercase tracking-wider">Item/Occasion</label>
                          <Input value={promotionItem} disabled={isReadOnly} onChange={e => setPromotionItem(e.target.value)} placeholder="Summer Sale" className="text-xs border-neutral-200 h-8 font-semibold" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-neutral-500 uppercase tracking-wider">Promo Code</label>
                          <Input value={promotionCode} disabled={isReadOnly} onChange={e => setPromotionCode(e.target.value)} placeholder="SUMMER20" className="text-xs border-neutral-200 h-8 font-semibold" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lead Form Extension */}
                  <div className="space-y-2 border-t border-neutral-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-neutral-700 font-sans">Lead Form Extension</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={hasLeadForm} disabled={isReadOnly} onChange={e => setHasLeadForm(e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-neutral-200 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                      </label>
                    </div>
                    {hasLeadForm && (
                      <div className="space-y-2 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                        <div>
                          <label className="text-[9px] font-black text-neutral-500 uppercase tracking-wider">Call-To-Action Button Text</label>
                          <Input value={leadFormTitle} disabled={isReadOnly} onChange={e => setLeadFormTitle(e.target.value)} placeholder="Get a Free Quote" className="text-xs border-neutral-200 h-8 font-semibold" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-[10px] text-amber-800 font-semibold">
                    💡 <strong>Ad Rank formula:</strong> Ad Rank = (Max CPC Bid) × (Quality Score) × (Expected Impact of Extensions). More extensions = better Ad Rank without increasing bids.
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Preview + Results */}
        <div className="lg:col-span-1 space-y-5">

          {/* Ad Preview */}
          <Card className="border border-neutral-200/80 shadow-md bg-white overflow-hidden text-left">
            <CardHeader className="border-b border-neutral-100 p-4 bg-neutral-50/50 flex flex-row items-center justify-between">
              <span className="text-xs font-black text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Live Ad Preview
              </span>
              <div className="flex gap-1.5">
                <button onClick={() => setPreviewDevice("mobile")} className={`p-1 rounded transition-colors ${previewDevice === "mobile" ? "bg-neutral-200 text-neutral-900" : "text-neutral-400"}`} title="Mobile">
                  <Smartphone className="h-4 w-4" />
                </button>
                <button onClick={() => setPreviewDevice("desktop")} className={`p-1 rounded transition-colors ${previewDevice === "desktop" ? "bg-neutral-200 text-neutral-900" : "text-neutral-400"}`} title="Desktop">
                  <Monitor className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-4 flex justify-center bg-neutral-100/50">
              {previewDevice === "mobile" ? (
                <div className="w-64 border-4 border-neutral-900 rounded-3xl bg-white p-3 shadow-inner font-sans">
                  <div className="flex justify-between items-center px-1 text-[8px] text-neutral-400 font-semibold mb-2">
                    <span>9:41 AM</span>
                    <span className="h-1.5 w-8 bg-neutral-950 rounded-full mx-auto" />
                    <span>100%</span>
                  </div>
                  <div className="space-y-1 p-2 border border-neutral-200/80 rounded-xl bg-white shadow-sm text-left">
                    <div className="flex items-center justify-between text-[9px] border-b border-neutral-100 pb-1">
                      <span className="flex items-center gap-1 font-black text-neutral-600"><Target className="h-3 w-3" /> Sponsored</span>
                      <span>︙</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 flex items-center gap-1 truncate mt-1">
                      <span>example.com</span>
                      {path1 && <span>› {path1}</span>}
                      {path2 && <span>› {path2}</span>}
                    </div>
                    <h4 className="text-sm font-medium text-[#1a0dab] leading-tight line-clamp-2">{headline1} | {headline2}</h4>
                    <p className="text-[10px] text-[#4d5156] leading-relaxed line-clamp-3">{description1}</p>
                    {/* Sitelinks in ad */}
                    <div className="pt-1.5 flex flex-wrap gap-1">
                      {sitelinks.slice(0, 2).map((sl, i) => (
                        <span key={i} className="text-[9px] text-[#1a0dab] border border-neutral-200 rounded px-1.5 py-0.5">{sl.title}</span>
                      ))}
                    </div>
                    {/* Callouts */}
                    {callouts.length > 0 && (
                      <p className="text-[9px] text-neutral-400 pt-1">{callouts.slice(0, 2).join(" · ")}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full border border-neutral-200 rounded-xl bg-white p-4 shadow-sm font-sans text-left space-y-1">
                  <div className="text-[10px] text-neutral-500 font-extrabold flex items-center gap-1">
                    <span>Sponsored</span><span>•</span>
                    <span className="text-neutral-700 font-bold">https://www.example.com{path1 ? `/${path1}` : ""}{path2 ? `/${path2}` : ""}</span>
                  </div>
                  <h4 className="text-base font-normal text-[#1a0dab] hover:underline cursor-pointer leading-tight truncate">
                    {headline1} | {headline2} | {headline3}
                  </h4>
                  <p className="text-[11px] text-[#4d5156] leading-relaxed">{description1} {description2}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {sitelinks.map((sl, i) => (
                      <span key={i} className="text-[10px] text-[#1a0dab] hover:underline cursor-pointer border-t border-neutral-200 pt-1">{sl.title}</span>
                    ))}
                  </div>
                  {callouts.length > 0 && (
                    <p className="text-[9px] text-neutral-500 pt-1">{callouts.join(" · ")}</p>
                  )}
                  {hasCallExtension && (
                    <p className="text-[10px] text-[#1a0dab] pt-1">📞 {callExtension}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Run Button */}
          <div className="flex flex-col gap-2 w-full">
            <Button
              onClick={handlePublishCampaign}
              disabled={simLoading}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700 font-black text-xs h-11 rounded-xl flex items-center justify-center gap-1.5 shadow-md"
            >
              <Play className="h-4 w-4 fill-white" />
              {simLoading ? "Running Auction Engine..." : "Publish Campaign to Auction"}
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

          {/* Results */}
          {simLoading && (
            <div className="h-48 border border-neutral-200/80 rounded-2xl flex flex-col items-center justify-center bg-neutral-50/50 shadow-md">
              <RefreshCw className="h-7 w-7 text-emerald-600 animate-spin mb-3" />
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Computing Quality Scores...</p>
            </div>
          )}

          {!simLoading && adResults && (
            <div className="space-y-4 animate-in fade-in duration-300">

              {/* Quality Score Breakdown */}
              <Card className="border border-neutral-200/80 shadow-md bg-white text-left">
                <CardHeader className="border-b border-neutral-100 p-4 bg-neutral-50/50 flex flex-row justify-between items-center">
                  <div>
                    <CardTitle className="text-xs font-black text-neutral-800 uppercase tracking-wider">Ad Quality Score</CardTitle>
                    <span className="text-[9px] font-semibold text-neutral-400">Google's 3-factor evaluation</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xl font-black block ${adResults.qualityScore >= 7 ? "text-emerald-600" : adResults.qualityScore >= 5 ? "text-amber-500" : "text-rose-500"}`}>
                      {adResults.qualityScore}/10
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {[
                    { label: "Expected CTR", score: adResults.expectedCtrScore, desc: "Likelihood your ad gets clicked vs competitors" },
                    { label: "Ad Relevance", score: adResults.adRelevanceScore, desc: "How closely your ad matches the search intent" },
                    { label: "Landing Page Experience", score: adResults.landingPageScore, desc: "URL relevance, load speed, mobile usability" },
                  ].map(f => (
                    <div key={f.label} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-neutral-700 truncate">{f.label}</p>
                        <p className="text-[9px] text-neutral-400 font-medium">{f.desc}</p>
                      </div>
                      <span className={`text-[10px] font-black shrink-0 px-2 py-0.5 rounded-full border ${
                        f.score >= 7 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        f.score >= 5 ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-rose-50 text-rose-700 border-rose-200"
                      }`}>
                        {adResults.qsLabel(f.score)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* PPC Metrics */}
              <Card className="border border-neutral-200/80 shadow-md bg-white text-left">
                <CardHeader className="border-b border-neutral-100 p-4 bg-neutral-50/50">
                  <CardTitle className="text-xs font-black text-neutral-800 uppercase tracking-wider">30-Day PPC Metrics</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { label: "Impressions", val: adResults.impressions.toLocaleString(), color: "text-neutral-800" },
                      { label: "Clicks", val: adResults.clicks.toLocaleString(), color: "text-neutral-800" },
                      { label: "CTR", val: `${adResults.ctr}%`, color: "text-indigo-600" },
                      { label: "Conversions", val: adResults.conversions.toString(), color: "text-emerald-600" },
                      { label: "Avg CPC", val: `$${adResults.avgCpc}`, color: "text-neutral-800" },
                      { label: "CPA", val: `$${adResults.cpa}`, color: adResults.cpa <= targetCpa ? "text-emerald-600" : "text-rose-500" },
                    ].map(m => (
                      <div key={m.label} className="p-2.5 rounded-lg border border-neutral-100 bg-neutral-50/50">
                        <span className="text-[9px] font-black text-neutral-400 uppercase block">{m.label}</span>
                        <span className={`text-sm font-black ${m.color} block mt-0.5`}>{m.val}</span>
                      </div>
                    ))}
                  </div>

                  {maxCpcBid < 1.0 && biddingStrategy === "manual_cpc" && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      Low bid cap! Ads may lose auctions for high-intent keywords.
                    </div>
                  )}

                  <div className="bg-neutral-900 text-white p-3 rounded-xl space-y-1">
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wide block">Revenue ROI Multiplier</span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-emerald-400">{adResults.roi}x</span>
                      <span className="text-[10px] text-neutral-400 font-semibold">Budget: ${adResults.spent.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Auction Insights */}
              <Card className="border border-neutral-200/80 shadow-md bg-white text-left">
                <CardHeader className="border-b border-neutral-100 p-4 bg-neutral-50/50">
                  <CardTitle className="text-xs font-black text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    Auction Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-neutral-50 text-[9px] font-black text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                      <tr>
                        <th className="px-3 py-2.5">Competitor</th>
                        <th className="px-3 py-2.5">Impr. Share</th>
                        <th className="px-3 py-2.5">Overlap</th>
                        <th className="px-3 py-2.5">Top Impr.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50 font-semibold text-neutral-700">
                      <tr className="bg-indigo-50/50">
                        <td className="px-3 py-2 font-black text-indigo-700">You</td>
                        <td className="px-3 py-2 text-indigo-700 font-black">{Math.min(99, Math.round(adResults.qualityScore * 7 + 20))}%</td>
                        <td className="px-3 py-2">—</td>
                        <td className="px-3 py-2 text-indigo-700 font-black">{Math.min(99, Math.round(adResults.qualityScore * 6 + 30))}%</td>
                      </tr>
                      {adResults.auctionData.map((a: any, i: number) => (
                        <tr key={i} className="hover:bg-neutral-50/40">
                          <td className="px-3 py-2 text-neutral-600">{a.competitor}</td>
                          <td className="px-3 py-2">{a.impressionShare}</td>
                          <td className="px-3 py-2">{a.overlapRate}</td>
                          <td className="px-3 py-2">{a.topImpr}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default GoogleAdsSimulationPage
