import { useState, useEffect } from "react"
import { useSearchParams, Link, useNavigate } from "react-router"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { toast } from "sonner"
import { 
  Play, Activity, Award, BookOpen, 
  MapPin, CheckCircle, RefreshCw, ShieldAlert,
  Settings, Clock, Sparkles, Download, ArrowRight, ArrowLeft,
  TrendingUp, BarChart3, AlertCircle, Plus, Trash2, HelpCircle
} from "lucide-react"
import { getSafeDashboardRoute, exitSandboxWorkspace } from "@/lib/navigation"

export function SandboxWorkspace() {
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const mode = searchParams.get("mode") || "GOOGLE_ADS"

  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [report, setReport] = useState<any>(null)
  const [checkingCert, setCheckingCert] = useState(false)
  const [certEligible, setCertEligible] = useState<any>(null)

  // Active form tab: "settings", "targeting", "bidding", "creative"
  const [activeFormTab, setActiveFormTab] = useState("setup")

  // ==========================================
  // 1. GOOGLE ADS STATES
  // ==========================================
  const [googleCampaignName, setGoogleCampaignName] = useState("Google Search Campaign")
  const [googleGoal, setGoogleGoal] = useState("Sales")
  const [googleType, setGoogleType] = useState("Search")
  const [googleNetwork, setGoogleNetwork] = useState("Google Search Partners")
  const [googleStatus, setGoogleStatus] = useState("Active")
  const [googleConversionGoal, setGoogleConversionGoal] = useState("Purchase")

  // Targeting
  const [googleLocation, setGoogleLocation] = useState("United States")
  const [googleRadius, setGoogleRadius] = useState(25)
  const [googleLanguage, setGoogleLanguage] = useState("English")
  const [googleDevices, setGoogleDevices] = useState<string[]>(["mobile", "desktop"])
  const [googleSchedule, setGoogleSchedule] = useState("All day")
  const [googleAudienceObs, setGoogleAudienceObs] = useState("In-market segment: retail shoppers")

  // Budget & Bidding
  const [googleDailyBudget, setGoogleDailyBudget] = useState(100)
  const [googleBidding, setGoogleBidding] = useState("Maximize Clicks")
  const [googleMaxCpc, setGoogleMaxCpc] = useState(1.50)
  const [googleTargetCpa, setGoogleTargetCpa] = useState(25.00)
  const [googleTargetRoas, setGoogleTargetRoas] = useState(250)
  const [googleCpcCap, setGoogleCpcCap] = useState(2.00)
  const [googleBidAdjust, setGoogleBidAdjust] = useState("+10% Desktop, -5% Tablet")

  // Ad Groups
  const [googleAdGroupName, setGoogleAdGroupName] = useState("Main Search AdGroup")
  const [googleAdGroupBid, setGoogleAdGroupBid] = useState(1.50)
  const [googleKeywordsInput, setGoogleKeywordsInput] = useState("crm software, sales tool")
  const [googleMatchType, setGoogleMatchType] = useState("phrase")

  // Negative Keywords
  const [googleNegativeInput, setGoogleNegativeInput] = useState("free, cheap")
  const [googleNegativeMatchType, setGoogleNegativeMatchType] = useState("Negative Phrase")

  // Responsive Search Ad Copy
  const [googleHeadlines, setGoogleHeadlines] = useState<string[]>([
    "Best B2B Sales CRM Software",
    "Streamline Your Client Pipeline",
    "Start 14-Day Free Trial Now",
    "Collaborative CRM Platform",
    "Top Team Analytics Tool"
  ])
  const [googleDescriptions, setGoogleDescriptions] = useState<string[]>([
    "Track deals, schedule reminders, and record pipelines inside a single shared dashboard.",
    "Modern customer pipeline software designed to scale B2B enterprise networks."
  ])
  const [googleDisplayPath1, setGoogleDisplayPath1] = useState("saas")
  const [googleDisplayPath2, setGoogleDisplayPath2] = useState("trial")
  const [googleLandingPage, setGoogleLandingPage] = useState("https://mycrm.com/landing")

  // Assets / Extensions
  const [googleSitelinks, setGoogleSitelinks] = useState("Pricing Plans, Book a Demo")
  const [googleCallouts, setGoogleCallouts] = useState("No Credit Card Required, 24/7 Enterprise Support")
  const [googleSnippets, setGoogleSnippets] = useState("Types: CRM, Pipeline Tracker, Deals Analytics")
  const [googleCall, setGoogleCall] = useState("+1-800-555-0190")
  const [googlePrice, setGooglePrice] = useState("Standard Plan - $29/user/month")
  const [googlePromo, setGooglePromo] = useState("Get 15% off first month with checkout code")

  // ==========================================
  // 2. META ADS STATES
  // ==========================================
  const [metaCampaignName, setMetaCampaignName] = useState("Meta Leads Campaign")
  const [metaObjective, setMetaObjective] = useState("leads")
  const [metaBuyingType, setMetaBuyingType] = useState("Auction")
  const [metaCbo, setMetaCbo] = useState(true)
  const [metaStatus, setMetaStatus] = useState("Active")

  // Ad Set
  const [metaAdSetName, setMetaAdSetName] = useState("Leads Generation AdSet")
  const [metaDailyBudget, setMetaDailyBudget] = useState(150)
  const [metaLifetimeBudget, setMetaLifetimeBudget] = useState(4500)
  const [metaStartDate, setMetaStartDate] = useState("2026-07-01")
  const [metaEndDate, setMetaEndDate] = useState("2026-07-30")
  const [metaOptGoal, setMetaOptGoal] = useState("Leads")
  const [metaBillingEvent, setMetaBillingEvent] = useState("Impressions")
  const [metaBidStrategy, setMetaBidStrategy] = useState("Highest volume")
  const [metaCostCap, setMetaCostCap] = useState(12.50)
  const [metaBidCap, setMetaBidCap] = useState(8.00)
  const [metaFreqCap, setMetaFreqCap] = useState(3)

  // Audience
  const [metaAudienceType, setMetaAudienceType] = useState("Core Audience")
  const [metaLocation, setMetaLocation] = useState("United States")
  const [metaRadius, setMetaRadius] = useState(50)
  const [metaAgeMin, setMetaAgeMin] = useState(25)
  const [metaAgeMax, setMetaAgeMax] = useState(54)
  const [metaGender, setMetaGender] = useState("all")
  const [metaLanguage, setMetaLanguage] = useState("English")
  const [metaInterests, setMetaInterests] = useState("Sales management, Business owner")
  const [metaBehaviors, setMetaBehaviors] = useState("Small business owners, Business travelers")
  const [metaJobTitles, setMetaJobTitles] = useState("Sales Director, CEO, Founder")
  const [metaEducation, setMetaEducation] = useState("College Graduate")
  const [metaInclude, setMetaInclude] = useState("Lookalike audience (1% match)")
  const [metaExclude, setMetaExclude] = useState("Current active app subscribers")
  const [metaLookalikePct, setMetaLookalikePct] = useState(1)

  // Placements
  const [metaAdvantagePlacements, setMetaAdvantagePlacements] = useState(true)
  const [metaManualPlacements, setMetaManualPlacements] = useState<string[]>([
    "Facebook Feed", "Instagram Feed", "Reels", "Stories"
  ])

  // Tracking
  const [metaPixelSource, setMetaPixelSource] = useState("DSimLab Meta Pixel Main")
  const [metaConversionEvent, setMetaConversionEvent] = useState("Lead")
  const [metaAttribution, setMetaAttribution] = useState("7-day click + 1-day view")
  const [metaUrlParams, setMetaUrlParams] = useState("utm_source=meta&utm_medium=paid-social&utm_campaign=leads")

  // Creative Builder
  const [metaCreativeFormat, setMetaCreativeFormat] = useState("single image")
  const [metaPrimaryText, setMetaPrimaryText] = useState("Start streamlining your team operations today. Free 14-day trial!")
  const [metaHeadline, setMetaHeadline] = useState("Collaborative CRM Software")
  const [metaDescription, setMetaDescription] = useState("Upgrade your team pipeline workflow.")
  const [metaCta, setMetaCta] = useState("LEARN_MORE")
  const [metaLandingPage, setMetaLandingPage] = useState("https://mycrm.com/social-leads")
  const [metaCreativeAngle, setMetaCreativeAngle] = useState("Problem-Solution")

  // ==========================================
  // 3. SEO STATES
  // ==========================================
  const [seoProjectName, setSeoProjectName] = useState("CRM Optimization Website Project")
  const [seoWebsiteUrl, setSeoWebsiteUrl] = useState("https://mycrm.com")
  const [seoPageType, setSeoPageType] = useState("Landing Page")
  const [seoIndustry, setSeoIndustry] = useState("SaaS Software")
  const [seoTargetCountry, setSeoTargetCountry] = useState("United States")
  const [seoTargetAudience, setSeoTargetAudience] = useState("B2B Sales Managers")
  const [seoObjective, setSeoObjective] = useState("Traffic Growth")

  // Keyword Research
  const [seoPrimaryKeyword, setSeoPrimaryKeyword] = useState("best crm software")
  const [seoSecondaryKeywordsInput, setSeoSecondaryKeywordsInput] = useState("team pipeline tool, b2b crm")
  const [seoSearchIntent, setSeoSearchIntent] = useState("commercial")
  const [seoKeywordDifficulty, setSeoKeywordDifficulty] = useState(45)
  const [seoSearchVolume, setSeoSearchVolume] = useState(2500)
  const [seoCompetitorDensity, setSeoCompetitorDensity] = useState(0.8)
  const [seoPriorityScore, setSeoPriorityScore] = useState(85)
  const [seoTargetRank, setSeoTargetRank] = useState(1)
  const [seoSerpFeatures, setSeoSerpFeatures] = useState<string[]>(["People Also Ask", "Featured Snippet"])

  // On Page SEO
  const [seoMetaTitle, setSeoMetaTitle] = useState("Collaborative CRM Tool | Streamline Deal Pipelines")
  const [seoMetaDescription, setSeoMetaDescription] = useState("Discover the top-rated cloud CRM software. Boost customer retention and manage active sales targets in one shared dashboard.")
  const [seoUrlSlug, setSeoUrlSlug] = useState("collaborative-crm-software")
  const [seoCanonicalUrl, setSeoCanonicalUrl] = useState("https://mycrm.com/collaborative-crm-software")
  const [seoH1, setSeoH1] = useState("The Collaborative Sales CRM for High-Growth Teams")
  const [seoH2H3Outline, setSeoH2H3Outline] = useState("H2: Core CRM Features, H2: Team Integrations, H3: Custom Pipeline Setup")
  const [seoBodyContent, setSeoBodyContent] = useState("A CRM tool helps collaborative teams automate redundant pipeline steps. Using modern CRM software allows sales reps to track client conversations, record deals, and access analytics logs instantly.")
  const [seoWordCount, setSeoWordCount] = useState(1250)
  const [seoKeywordDensity, setSeoKeywordDensity] = useState(2.2)
  const [seoSemanticCoverage, setSeoSemanticCoverage] = useState(85)
  const [seoReadabilityScore, setSeoReadabilityScore] = useState(72)
  const [seoCtaPresence, setSeoCtaPresence] = useState(true)
  const [seoDuplicateRisk, setSeoDuplicateRisk] = useState(5)
  const [seoImageAltText, setSeoImageAltText] = useState("CRM dashboard pipeline overview")
  const [seoSchemaMarkup, setSeoSchemaMarkup] = useState("Product Schema")
  const [seoFaqSchema, setSeoFaqSchema] = useState(true)

  // Technical SEO
  const [seoTechnicalSSL, setSeoTechnicalSSL] = useState(true)
  const [seoTechnicalSitemap, setSeoTechnicalSitemap] = useState(true)
  const [seoTechnicalMobile, setSeoTechnicalMobile] = useState(true)
  const [seoTechnicalRobots, setSeoTechnicalRobots] = useState(true)
  const [seoPageSpeed, setSeoPageSpeed] = useState(88)
  const [seoLcp, setSeoLcp] = useState(1.5)
  const [seoCls, setSeoCls] = useState(0.03)
  const [seoInp, setSeoInp] = useState(60)
  const [seoBrokenLinks, setSeoBrokenLinks] = useState(0)

  // Internal Linking
  const [seoInternalLinksSource, setSeoInternalLinksSource] = useState("/blog")
  const [seoInternalLinksTarget, setSeoInternalLinksTarget] = useState("/crm-software")
  const [seoInternalLinksAnchor, setSeoInternalLinksAnchor] = useState("CRM software SaaS")

  // Backlinks & Off Page
  const [seoBacklinkBudget, setSeoBacklinkBudget] = useState(250)
  const [seoBacklinkQuality, setSeoBacklinkQuality] = useState(2)
  const [seoAnchorTextDiversity, setSeoAnchorTextDiversity] = useState("Brand Name, Target Keyword, Generic")
  const [seoToxicLinkRisk, setSeoToxicLinkRisk] = useState(10)

  // Competitors
  const [seoCompetitorDomain, setSeoCompetitorDomain] = useState("competitor-crm.com")
  const [seoCompetitorRank, setSeoCompetitorRank] = useState(3)
  const [seoCompetitorContentScore, setSeoCompetitorContentScore] = useState(78)
  const [seoCompetitorAuthorityScore, setSeoCompetitorAuthorityScore] = useState(55)

  // ==========================================
  // DATA ACTIONS
  // ==========================================
  const loadWorkspaceState = async () => {
    setLoading(true)
    try {
      const res = await api.get<any>("/api/v1/sandbox/state")
      if (res.data?.success && res.data.hasState) {
        setState(res.data.state)
        setProgress(res.data.progress)

        // Lock simulationMode if restricted
        const correctMode = res.data.state.simulationMode;
        if (correctMode && correctMode !== mode) {
          navigate(`/sandbox/workspace?mode=${correctMode}`, { replace: true });
          return;
        }
        
        // Load report if round > 1 or completed
        if (res.data.state.currentRound > 1 || res.data.state.isCompleted || res.data.state.status === 'RESULTS_READY') {
          const repRes = await api.get<any>("/api/v1/sandbox/report")
          if (repRes.data?.success) {
            setReport(repRes.data)
          }
          await checkCertificate()
        }

        // Load current decision if exists
        const decRes = await api.get<any>("/api/v1/sandbox/decision")
        if (decRes.data?.success && decRes.data.decision) {
          const dec = decRes.data.decision;
          if (mode === "GOOGLE_ADS" && dec.googleCampaigns) {
            try {
              const camps = typeof dec.googleCampaigns === 'string' ? JSON.parse(dec.googleCampaigns) : dec.googleCampaigns;
              const camp = camps[0];
              if (camp) {
                setGoogleCampaignName(camp.name || "Google Search Campaign");
                setGoogleGoal(camp.objective || "Sales");
                setGoogleBidding(camp.biddingStrategy || "Maximize Clicks");
                setGoogleMaxCpc(camp.maxCpcBid || 1.50);
                setGoogleDailyBudget((camp.budget || 3000) / 30);
                const kwStrs = (camp.keywords || []).map((k: any) => k.word || k).join(", ");
                setGoogleKeywordsInput(kwStrs || "");
                setGoogleMatchType(camp.keywords?.[0]?.matchType || "phrase");
                const negStrs = (camp.negativeKeywords || []).map((k: any) => k.word || k).join(", ");
                setGoogleNegativeInput(negStrs || "");
                const ad = camp.adCopy || camp.adGroups?.[0]?.ads?.[0] || {};
                
                if (ad.headlines) setGoogleHeadlines(ad.headlines);
                else if (ad.headline1) setGoogleHeadlines([ad.headline1, ad.headline2 || "", ad.headline3 || ""]);

                if (ad.descriptions) setGoogleDescriptions(ad.descriptions);
                else if (ad.description1) setGoogleDescriptions([ad.description1, ad.description2 || ""]);

                setGoogleLandingPage(ad.finalUrl || ad.landingPageUrl || "");
                if (camp.extensions?.sitelinks) {
                  setGoogleSitelinks(camp.extensions.sitelinks.join(", "));
                }
                setGoogleLocation(camp.locations?.[0] || "Global");
              }
            } catch(e){}
          } else if (mode === "META_ADS" && dec.metaCampaigns) {
            try {
              const camps = typeof dec.metaCampaigns === 'string' ? JSON.parse(dec.metaCampaigns) : dec.metaCampaigns;
              const camp = camps[0];
              const adSet = camp?.adSets?.[0] || camp || {};
              if (camp) {
                setMetaCampaignName(camp.name || "Meta Leads Campaign");
                setMetaObjective(camp.objective || adSet.objective || "leads");
                setMetaAgeMin(adSet.targeting?.ageMin || adSet.ageMin || 25);
                setMetaAgeMax(adSet.targeting?.ageMax || adSet.ageMax || 54);
                setMetaGender(adSet.targeting?.gender || adSet.gender || "all");
                setMetaInterests(adSet.targeting?.interests || camp.audienceInterest || "");
                setMetaPlacement(adSet.placement || camp.placement || "feed-reels");
                setMetaDailyBudget(adSet.dailyBudget || (camp.budget / 30) || 150);
                
                const creative = adSet.creative || camp.creative || {};
                setMetaCreativeFormat(creative.format || "image");
                setMetaPrimaryText(creative.primaryText || "");
                setMetaHeadline(creative.headline || "");
                setMetaCta(creative.cta || "LEARN_MORE");
                setMetaLandingPage(creative.destinationUrl || creative.landingPageUrl || "");
              }
            } catch(e){}
          } else if (mode === "SEO") {
            try {
              const kws = typeof dec.seoTargetKeywords === 'string' ? JSON.parse(dec.seoTargetKeywords) : dec.seoTargetKeywords;
              setSeoTargetKeywordsInput(kws ? kws.join(", ") : "");
            } catch(e){}
            setSeoMetaTitle(dec.seoMetaTitle || "");
            setSeoMetaDescription(dec.seoMetaDescription || "");
            setSeoBodyContent(dec.seoBodyContent || "");
            setSeoUrlSlug(dec.seoUrlSlug || "");
            setSeoBacklinkBudget(dec.seoBacklinkBudget || 250);
            
            if (dec.seoTechnicalConfig) {
              try {
                const tc = typeof dec.seoTechnicalConfig === 'string' ? JSON.parse(dec.seoTechnicalConfig) : dec.seoTechnicalConfig;
                setSeoTechnicalSSL(tc.hasSsl ?? tc.hasSssl ?? true);
                setSeoTechnicalSitemap(tc.hasSitemap ?? true);
                setSeoTechnicalMobile(tc.isMobileFriendly ?? true);
                setSeoTechnicalRobots(tc.hasRobots ?? true);
              } catch(e){}
            }
          }
        }
      } else {
        toast.error("No active sandbox simulation found.")
        setState(null)
      }
    } catch (e) {
      console.error(e)
      toast.error("Failed to load workspace.")
    } finally {
      setLoading(false)
    }
  }

  const checkCertificate = async () => {
    try {
      setCheckingCert(true)
      const res = await api.get<any>("/api/v1/sandbox/certificate/check")
      if (res.data?.success) {
        setCertEligible(res.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCheckingCert(false)
    }
  }

  const handleSaveDecision = async () => {
    const tid = toast.loading("Saving settings...")
    try {
      let payload = {}

      if (mode === "GOOGLE_ADS") {
        const kws = googleKeywordsInput.split(",").map(k => k.trim()).filter(Boolean).map(word => ({
          word,
          bid: googleMaxCpc,
          matchType: googleMatchType
        }))
        const negKws = googleNegativeInput.split(",").map(k => k.trim()).filter(Boolean).map(text => ({
          text,
          matchType: googleNegativeMatchType
        }))

        payload = {
          googleCampaigns: [
            {
              name: googleCampaignName,
              budget: googleDailyBudget * 30,
              objective: googleGoal,
              biddingStrategy: googleBidding,
              maxCpcBid: googleMaxCpc,
              keywords: kws,
              negativeKeywords: negKws,
              locations: [googleLocation],
              adCopy: {
                headlines: googleHeadlines,
                descriptions: googleDescriptions,
                finalUrl: googleLandingPage,
                displayPath1: googleDisplayPath1,
                displayPath2: googleDisplayPath2
              },
              extensions: {
                sitelinks: googleSitelinks.split(",").map(s => s.trim()).filter(Boolean),
                callouts: googleCallouts.split(",").map(c => c.trim()).filter(Boolean),
                structuredSnippets: googleSnippets.split(",").map(s => s.trim()).filter(Boolean),
                callExtension: googleCall,
                priceExtension: googlePrice,
                promotionExtension: googlePromo
              }
            }
          ]
        }
      } else if (mode === "META_ADS") {
        payload = {
          metaCampaigns: [
            {
              name: metaCampaignName,
              budget: metaDailyBudget * 30,
              objective: metaObjective,
              audienceInterest: metaInterests,
              placement: metaPlacement,
              bidType: metaBidStrategy,
              bidAmount: metaBidCap,
              creative: {
                format: metaCreativeFormat,
                primaryText: metaPrimaryText,
                headline: metaHeadline,
                description: metaDescription,
                cta: metaCta,
                destinationUrl: metaLandingPage,
                angle: metaCreativeAngle
              },
              adSets: [
                {
                  name: metaAdSetName,
                  dailyBudget: metaDailyBudget,
                  bidStrategy: metaBidStrategy,
                  bidAmount: metaBidCap,
                  costCap: metaCostCap,
                  frequencyCap: metaFreqCap,
                  targeting: {
                    ageMin: metaAgeMin,
                    ageMax: metaAgeMax,
                    gender: metaGender,
                    interests: metaInterests,
                    behaviors: metaBehaviors,
                    jobTitles: metaJobTitles,
                    education: metaEducation
                  },
                  placements: metaAdvantagePlacements ? ["auto"] : metaManualPlacements
                }
              ]
            }
          ]
        }
      } else if (mode === "SEO") {
        payload = {
          seoTargetKeywords: seoTargetKeywordsInput.split(",").map(k => k.trim()).filter(Boolean),
          seoContentQuality: 8.5, // comp logic bonus
          seoBacklinkBudget: seoBacklinkBudget,
          seoMetaTitle,
          seoMetaDescription,
          seoBodyContent,
          seoUrlSlug,
          seoInternalLinks: 3,
          seoAnchorText: seoInternalLinksAnchor,
          seoBacklinkQuality,
          seoTechnicalConfig: {
            hasSitemap: seoTechnicalSitemap,
            hasRobots: seoTechnicalRobots,
            hasSsl: seoTechnicalSSL,
            isMobileFriendly: seoTechnicalMobile
          },
          seoCoreWebVitals: {
            lcp: seoLcp,
            cls: seoCls,
            inp: seoInp
          }
        }
      }

      const res = await api.post<any>("/api/v1/sandbox/decision", payload)
      if (res.data?.success) {
        toast.success("Settings saved successfully!", { id: tid })
      } else {
        toast.error("Failed to save decisions.", { id: tid })
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save settings.", { id: tid })
    }
  }

  const handleRunSimulation = async () => {
    const tid = toast.loading("Executing campaign settings...")
    try {
      const res = await api.post<any>("/api/v1/sandbox/run")
      if (res.data?.success) {
        if (res.data.instant) {
          toast.success("Campaign advanced instantly!", { id: tid })
        } else {
          toast.success("Campaign submitted! Processing scheduled.", { id: tid })
        }
        await loadWorkspaceState()
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to run simulation.", { id: tid })
    }
  }

  const handleNextRound = async () => {
    const tid = toast.loading("Opening next round cycle...")
    try {
      const res = await api.post<any>("/api/v1/sandbox/next-cycle")
      if (res.data?.success) {
        toast.success("Next round cycle initialized!", { id: tid })
        await loadWorkspaceState()
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to start next cycle.", { id: tid })
    }
  }

  const handleFastForward = async () => {
    const tid = toast.loading("Advancing round instantly...")
    try {
      const res = await api.post<any>("/api/v1/sandbox/fast-forward")
      if (res.data?.success) {
        toast.success("Round advanced successfully!", { id: tid })
        await loadWorkspaceState()
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Fast forward failed.", { id: tid })
    }
  }

  const handleResetSandbox = async () => {
    if (confirm("Are you sure you want to reset your sandbox console and clear all records?")) {
      const tid = toast.loading("Resetting simulation...")
      try {
        await api.post<any>("/api/v1/sandbox/start", {
          simulationMode: mode,
          scenarioId: state.class?.scenarioId,
          durationDays: state.class?.scenario?.durationDays
        })
        toast.success("Sandbox reset successfully!", { id: tid })
        await loadWorkspaceState()
      } catch (err) {
        toast.error("Failed to reset workspace.", { id: tid })
      }
    }
  }

  useEffect(() => {
    loadWorkspaceState()
  }, [mode])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin" />
        <span className="text-sm text-neutral-500 font-bold">Loading simulation workbench...</span>
      </div>
    )
  }

  const isValidMode = ["GOOGLE_ADS", "META_ADS", "SEO"].includes(mode)

  if (!isValidMode || !state) {
    const dashboardRoute = getSafeDashboardRoute(user?.role)
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
        <div className="bg-white border border-neutral-200 rounded-2xl p-10 max-w-md w-full shadow-xl space-y-6">
          <div className="flex justify-center">
            <div className="h-20 w-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center relative">
              <ShieldAlert className="h-10 w-10 text-indigo-600 animate-bounce" />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-indigo-650 uppercase tracking-widest block">
              Sandbox Workspace Guard
            </span>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
              Invalid or Missing Workspace
            </h1>
            <p className="text-xs text-neutral-500 leading-relaxed max-w-[280px] mx-auto font-semibold">
              The requested sandbox simulation workspace is invalid or no active session was found. You can start a new simulation or return to your dashboard.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button 
              onClick={() => navigate("/simulation")} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 py-5 shadow-sm"
            >
              Go to Simulation Console
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate(dashboardRoute)}
              className="border-neutral-200 hover:bg-neutral-50 rounded-lg font-bold flex items-center justify-center gap-2 py-5 text-neutral-700"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const isCompleted = state.isCompleted || state.status === "COMPLETED" || state.status === "SCORE_LOCKED"
  const isProcessing = state.status === "PROCESSING" || progress?.status === "PROCESSING"
  const isResultsReady = state.status === "RESULTS_READY"

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-neutral-100/50">
        <button 
          onClick={() => exitSandboxWorkspace(navigate, user?.role)}
          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors focus:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Simulation Console
        </button>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(getSafeDashboardRoute(user?.role))}
            className="text-xs border-neutral-205 rounded-xl px-4 h-8 font-bold"
          >
            Return to Dashboard
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => exitSandboxWorkspace(navigate, user?.role)}
            className="text-xs rounded-xl px-4 h-8 font-black bg-rose-600 hover:bg-rose-700 text-white border-none"
          >
            Exit Sandbox Workspace
          </Button>
        </div>
      </div>

      {/* Console Details */}
      <div className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-sm text-left flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <Badge className="bg-indigo-50 text-indigo-900 border-none uppercase text-[9px] font-black tracking-widest px-2.5 py-1">
            Sandbox Live Console
          </Badge>
          <h1 className="text-2xl font-black text-neutral-900">
            {state.class?.scenario?.name}
          </h1>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-xs font-semibold text-neutral-500 pt-2">
            <div>
              Simulation Type: <span className="text-neutral-850 font-black">{mode.replace('_', ' ')}</span>
            </div>
            <div>
              Scenario Type: <span className="text-neutral-850 font-black uppercase text-[10px]">{state.class?.scenario?.scenarioType}</span>
            </div>
            <div>
              Timing Rule: <span className="text-neutral-850 font-black">{state.class?.scenario?.trendRefreshFrequency === 'instant' ? 'Instant runs' : '24h standard lock'}</span>
            </div>
            <div>
              Day / Round: <span className="text-indigo-650 font-black">Round {state.currentRound} of {state.class?.scenario?.maxRounds}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[10px] text-neutral-400 font-black uppercase tracking-wider block">Workspace Status</span>
            {isProcessing ? (
              <Badge className="bg-amber-50 text-amber-850 border border-amber-200 font-black text-[10px] animate-pulse">
                Processing Campaign...
              </Badge>
            ) : isResultsReady ? (
              <Badge className="bg-indigo-50 text-indigo-850 border border-indigo-200 font-black text-[10px]">
                Results Ready
              </Badge>
            ) : isCompleted ? (
              <Badge className="bg-rose-50 text-rose-850 border border-rose-200 font-black text-[10px]">
                Simulation Completed
              </Badge>
            ) : (
              <Badge className="bg-emerald-50 text-emerald-850 border border-emerald-250 font-black text-[10px]">
                Ready for Decisions
              </Badge>
            )}
          </div>
          <div className="h-10 w-[1px] bg-neutral-200 hidden md:block" />
          <div className="text-right">
            <span className="text-[10px] text-neutral-400 font-black uppercase tracking-wider block">Cumulative Score</span>
            <span className="text-lg font-black text-indigo-650">{state.score || 0}%</span>
          </div>
        </div>
      </div>

      {/* Main Workspace split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Input Form */}
        <div className="lg:col-span-2 space-y-6 text-left">
          
          {!isCompleted && !isProcessing && !isResultsReady ? (
            <Card className="p-6 border-neutral-200 shadow-sm bg-white space-y-6">
              
              {/* Form Navigation Tabs */}
              <div className="flex gap-2 border-b border-neutral-100 pb-3 flex-wrap">
                {[
                  { key: "setup", label: "Campaign & Ad Set" },
                  { key: "targeting", label: "Audience & Placements" },
                  { key: "keywords", label: mode === "SEO" ? "On-Page SEO Settings" : "Keywords & Ads" },
                  { key: "creative", label: "Ad Creatives & Assets" }
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveFormTab(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFormTab === t.key 
                        ? "bg-indigo-50 text-indigo-950 shadow-sm" 
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* GOOGLE ADS VIEW */}
              {mode === "GOOGLE_ADS" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  
                  {activeFormTab === "setup" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="google-campaign-name" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Campaign Name</label>
                          <input 
                            id="google-campaign-name"
                            name="googleCampaignName"
                            type="text"
                            value={googleCampaignName}
                            onChange={(e) => setGoogleCampaignName(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="google-goal" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Campaign Objective</label>
                          <select 
                            id="google-goal"
                            name="googleGoal"
                            value={googleGoal} 
                            onChange={(e) => setGoogleGoal(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none"
                          >
                            <option value="Sales">Sales (E-Commerce)</option>
                            <option value="Leads">Leads Acquisition</option>
                            <option value="Website Traffic">Website Traffic</option>
                            <option value="Brand Awareness">Brand Awareness</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="google-type" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Campaign Type</label>
                          <input id="google-type" name="googleType" type="text" readOnly value={googleType} className="w-full px-3 py-2 text-xs font-bold border border-neutral-100 rounded-xl bg-neutral-50 cursor-not-allowed focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="google-network" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Network targeting</label>
                          <select id="google-network" name="googleNetwork" value={googleNetwork} onChange={(e) => setGoogleNetwork(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none">
                            <option value="Google Search">Google Search only</option>
                            <option value="Google Search Partners">Google Search + Partners Network</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="google-conversion-goal" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Conversion Goal</label>
                          <select id="google-conversion-goal" name="googleConversionGoal" value={googleConversionGoal} onChange={(e) => setGoogleConversionGoal(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none">
                            <option value="Purchase">Purchase</option>
                            <option value="Lead Form">Lead Form</option>
                            <option value="Signup">Signup</option>
                            <option value="Add to Cart">Add to Cart</option>
                            <option value="Phone Call">Phone Call</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFormTab === "targeting" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="google-location" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Target Location</label>
                          <input id="google-location" name="googleLocation" type="text" value={googleLocation} onChange={(e) => setGoogleLocation(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="google-radius" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Target Radius (Miles)</label>
                          <input id="google-radius" name="googleRadius" type="number" value={googleRadius} onChange={(e) => setGoogleRadius(Number(e.target.value))} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="google-language" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Language</label>
                          <input id="google-language" name="googleLanguage" type="text" value={googleLanguage} onChange={(e) => setGoogleLanguage(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="google-schedule" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Ad Schedule</label>
                          <select id="google-schedule" name="googleSchedule" value={googleSchedule} onChange={(e) => setGoogleSchedule(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none">
                            <option value="All day">All day</option>
                            <option value="Business hours">Business hours</option>
                            <option value="Custom hours">Custom hours</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-neutral-600 uppercase block mb-1.5">Devices</label>
                          <div className="flex gap-3 text-xs font-bold items-center h-8">
                            {["mobile", "desktop", "tablet"].map(device => (
                              <label key={device} className="flex items-center gap-1 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={googleDevices.includes(device)} 
                                  onChange={(e) => {
                                    if (e.target.checked) setGoogleDevices([...googleDevices, device]);
                                    else setGoogleDevices(googleDevices.filter(d => d !== device));
                                  }} 
                                />
                                <span className="capitalize">{device}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="google-audience-obs" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Audience Observation Signals</label>
                        <input id="google-audience-obs" name="googleAudienceObs" type="text" value={googleAudienceObs} onChange={(e) => setGoogleAudienceObs(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                      </div>
                    </div>
                  )}

                  {activeFormTab === "keywords" && (
                    <div className="space-y-4">
                      
                      <div className="bg-indigo-50/10 border border-indigo-100/50 rounded-xl p-4 space-y-4">
                        <span className="text-[10px] font-black text-indigo-650 uppercase block">Ad Group Config</span>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="google-ad-group-name" className="text-[10px] font-black text-neutral-600 block mb-1">Ad Group Name</label>
                            <input id="google-ad-group-name" name="googleAdGroupName" type="text" value={googleAdGroupName} onChange={(e) => setGoogleAdGroupName(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="google-ad-group-bid" className="text-[10px] font-black text-neutral-600 block mb-1">Default Bid ($)</label>
                            <input id="google-ad-group-bid" name="googleAdGroupBid" type="number" step="0.1" value={googleAdGroupBid} onChange={(e) => setGoogleAdGroupBid(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="google-keywords" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Target Keywords (comma-separated)</label>
                          <input 
                            id="google-keywords"
                            name="googleKeywords"
                            type="text" 
                            value={googleKeywordsInput} 
                            onChange={(e) => setGoogleKeywordsInput(e.target.value)}
                            placeholder="best crm, CRM SaaS"
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="google-match-type" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Match Type</label>
                          <select 
                            id="google-match-type"
                            name="googleMatchType"
                            value={googleMatchType} 
                            onChange={(e) => setGoogleMatchType(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none"
                          >
                            <option value="exact">Exact Match</option>
                            <option value="phrase">Phrase Match</option>
                            <option value="broad">Broad Match</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="google-negative-keywords" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Negative Keywords (comma-separated)</label>
                          <input 
                            id="google-negative-keywords"
                            name="googleNegativeKeywords"
                            type="text" 
                            value={googleNegativeInput} 
                            onChange={(e) => setGoogleNegativeInput(e.target.value)}
                            placeholder="free, cheap"
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="google-negative-match-type" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Negative Match Type</label>
                          <select 
                            id="google-negative-match-type"
                            name="googleNegativeMatchType"
                            value={googleNegativeMatchType} 
                            onChange={(e) => setGoogleNegativeMatchType(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none"
                          >
                            <option value="Negative Exact">Negative Exact</option>
                            <option value="Negative Phrase">Negative Phrase</option>
                            <option value="Negative Broad">Negative Broad</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFormTab === "creative" && (
                    <div className="space-y-4">
                      
                      {/* Bidding Adjustments */}
                      <div className="bg-neutral-50/50 border border-neutral-200/60 rounded-xl p-4 space-y-3">
                        <span className="text-[10px] font-black text-neutral-600 uppercase block border-b border-neutral-200 pb-1.5">Bidding Details</span>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="google-bidding" className="text-[10px] font-black text-neutral-500 block mb-1">Bidding Strategy</label>
                            <select id="google-bidding-2" value={googleBidding} onChange={(e) => setGoogleBidding(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none bg-white">
                              <option value="Maximize Clicks">Maximize Clicks</option>
                              <option value="Maximize Conversions">Maximize Conversions</option>
                              <option value="Target CPA">Target CPA</option>
                              <option value="Target ROAS">Target ROAS</option>
                              <option value="Manual CPC">Manual CPC</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="google-daily-budget" className="text-[10px] font-black text-neutral-500 block mb-1">Daily Budget ($)</label>
                            <input id="google-daily-budget-2" type="number" value={googleDailyBudget} onChange={(e) => setGoogleDailyBudget(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-1">
                          {googleBidding === "Manual CPC" && (
                            <div>
                              <label htmlFor="google-max-cpc" className="text-[10px] font-black text-neutral-500 block mb-1">Max CPC Bid ($)</label>
                              <input id="google-max-cpc" type="number" step="0.05" value={googleMaxCpc} onChange={(e) => setGoogleMaxCpc(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                            </div>
                          )}
                          {googleBidding === "Target CPA" && (
                            <div>
                              <label htmlFor="google-target-cpa" className="text-[10px] font-black text-neutral-500 block mb-1">Target CPA ($)</label>
                              <input id="google-target-cpa" type="number" value={googleTargetCpa} onChange={(e) => setGoogleTargetCpa(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                            </div>
                          )}
                          {googleBidding === "Target ROAS" && (
                            <div>
                              <label htmlFor="google-target-roas" className="text-[10px] font-black text-neutral-500 block mb-1">Target ROAS (%)</label>
                              <input id="google-target-roas" type="number" value={googleTargetRoas} onChange={(e) => setGoogleTargetRoas(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                            </div>
                          )}
                          {googleBidding === "Maximize Clicks" && (
                            <div>
                              <label htmlFor="google-cpc-cap" className="text-[10px] font-black text-neutral-500 block mb-1">CPC Bid Cap ($)</label>
                              <input id="google-cpc-cap" type="number" step="0.05" value={googleCpcCap} onChange={(e) => setGoogleCpcCap(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                            </div>
                          )}
                          <div>
                            <label htmlFor="google-bid-adjust" className="text-[10px] font-black text-neutral-500 block mb-1">Bid Adjustments</label>
                            <input id="google-bid-adjust" type="text" value={googleBidAdjust} onChange={(e) => setGoogleBidAdjust(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                          </div>
                        </div>
                      </div>

                      <div className="border border-neutral-200/60 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-neutral-600 uppercase block border-b border-neutral-100 pb-1.5">Responsive Search Ad Copy Editor</span>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 block">Ad Headlines (3 to 15)</label>
                            {googleHeadlines.slice(0, 5).map((hl, index) => (
                              <input 
                                key={index}
                                type="text" 
                                value={hl} 
                                onChange={(e) => {
                                  const updated = [...googleHeadlines];
                                  updated[index] = e.target.value;
                                  setGoogleHeadlines(updated);
                                }}
                                placeholder={`Headline ${index + 1}`}
                                className="w-full px-2.5 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" 
                              />
                            ))}
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-neutral-500 block">Ad Descriptions (2 to 4)</label>
                            {googleDescriptions.slice(0, 3).map((desc, index) => (
                              <textarea 
                                key={index}
                                value={desc} 
                                onChange={(e) => {
                                  const updated = [...googleDescriptions];
                                  updated[index] = e.target.value;
                                  setGoogleDescriptions(updated);
                                }}
                                rows={2}
                                placeholder={`Description ${index + 1}`}
                                className="w-full px-2.5 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" 
                              />
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-1">
                          <div>
                            <label htmlFor="google-display-path-1" className="text-[10px] font-black text-neutral-500 block mb-1">Display Path 1</label>
                            <input id="google-display-path-1" type="text" value={googleDisplayPath1} onChange={(e) => setGoogleDisplayPath1(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="google-display-path-2" className="text-[10px] font-black text-neutral-500 block mb-1">Display Path 2</label>
                            <input id="google-display-path-2" type="text" value={googleDisplayPath2} onChange={(e) => setGoogleDisplayPath2(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="google-landing-page" className="text-[10px] font-black text-neutral-500 block mb-1">Final Destination URL</label>
                            <input id="google-landing-page" type="text" value={googleLandingPage} onChange={(e) => setGoogleLandingPage(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                        </div>
                      </div>

                      <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-neutral-600 uppercase block border-b border-neutral-200 pb-1.5">Assets & Extensions Setup</span>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="google-sitelinks" className="text-[10px] font-black text-neutral-500 block mb-1">Sitelinks (comma-separated)</label>
                            <input id="google-sitelinks" type="text" value={googleSitelinks} onChange={(e) => setGoogleSitelinks(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="google-callouts" className="text-[10px] font-black text-neutral-500 block mb-1">Callouts (comma-separated)</label>
                            <input id="google-callouts" type="text" value={googleCallouts} onChange={(e) => setGoogleCallouts(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="google-snippets" className="text-[10px] font-black text-neutral-500 block mb-1">Structured Snippets</label>
                            <input id="google-snippets" type="text" value={googleSnippets} onChange={(e) => setGoogleSnippets(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="google-call" className="text-[10px] font-black text-neutral-500 block mb-1">Call Extension</label>
                            <input id="google-call" type="text" value={googleCall} onChange={(e) => setGoogleCall(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="google-price" className="text-[10px] font-black text-neutral-500 block mb-1">Price Extensions</label>
                            <input id="google-price" type="text" value={googlePrice} onChange={(e) => setGooglePrice(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="google-promo" className="text-[10px] font-black text-neutral-500 block mb-1">Promotion Extensions</label>
                            <input id="google-promo" type="text" value={googlePromo} onChange={(e) => setGooglePromo(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* META ADS VIEW */}
              {mode === "META_ADS" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  
                  {activeFormTab === "setup" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="meta-campaign-name" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Campaign Name</label>
                          <input id="meta-campaign-name" type="text" value={metaCampaignName} onChange={(e) => setMetaCampaignName(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-buying-type" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Buying Type</label>
                          <select id="meta-buying-type" value={metaBuyingType} onChange={(e) => setMetaBuyingType(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none">
                            <option value="Auction">Auction</option>
                            <option value="Reach and Frequency">Reach and Frequency</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="meta-objective" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Objective</label>
                          <select id="meta-objective" value={metaObjective} onChange={(e) => setMetaObjective(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none">
                            <option value="sales">Sales (Conversions)</option>
                            <option value="leads">Leads acquisition</option>
                            <option value="traffic">Traffic clicks</option>
                            <option value="awareness">Brand awareness</option>
                            <option value="engagement">Page engagements</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="meta-adset-name" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Ad Set Name</label>
                          <input id="meta-adset-name" type="text" value={metaAdSetName} onChange={(e) => setMetaAdSetName(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-cbo" className="text-[10px] font-black text-neutral-600 uppercase block mb-1.5">Campaign Budget Optimization</label>
                          <div className="flex items-center h-8">
                            <input id="meta-cbo" type="checkbox" checked={metaCbo} onChange={(e) => setMetaCbo(e.target.checked)} className="h-4 w-4 text-indigo-650" />
                            <label htmlFor="meta-cbo" className="text-xs font-bold text-neutral-600 ml-2">Enabled (CBO)</label>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="meta-daily-budget" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Daily Budget ($)</label>
                          <input id="meta-daily-budget" type="number" value={metaDailyBudget} onChange={(e) => setMetaDailyBudget(Number(e.target.value))} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-lifetime-budget" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Lifetime Budget ($)</label>
                          <input id="meta-lifetime-budget" type="number" value={metaLifetimeBudget} onChange={(e) => setMetaLifetimeBudget(Number(e.target.value))} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="meta-start-date" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Start Date</label>
                          <input id="meta-start-date" type="date" value={metaStartDate} onChange={(e) => setMetaStartDate(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-end-date" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">End Date</label>
                          <input id="meta-end-date" type="date" value={metaEndDate} onChange={(e) => setMetaEndDate(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-billing-event" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Billing Event</label>
                          <select id="meta-billing-event" value={metaBillingEvent} onChange={(e) => setMetaBillingEvent(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none">
                            <option value="Impressions">Impressions (CPM)</option>
                            <option value="Link Clicks">Link Clicks (CPC)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFormTab === "targeting" && (
                    <div className="space-y-4">
                      
                      <div className="bg-neutral-50 border border-neutral-200/60 p-4 rounded-xl grid grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="meta-audience-type" className="text-[10px] font-black text-neutral-600 block mb-1">Audience Type</label>
                          <select id="meta-audience-type" value={metaAudienceType} onChange={(e) => setMetaAudienceType(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none bg-white">
                            <option value="Core Audience">Core Audience</option>
                            <option value="Custom Audience">Custom Audience</option>
                            <option value="Lookalike Audience">Lookalike Audience</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="meta-location" className="text-[10px] font-black text-neutral-600 block mb-1">Location Target</label>
                          <input id="meta-location" type="text" value={metaLocation} onChange={(e) => setMetaLocation(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-radius" className="text-[10px] font-black text-neutral-600 block mb-1">Radius (Miles)</label>
                          <input id="meta-radius" type="number" value={metaRadius} onChange={(e) => setMetaRadius(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="meta-age-min" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Min Age</label>
                          <input id="meta-age-min" type="number" value={metaAgeMin} onChange={(e) => setMetaAgeMin(Number(e.target.value))} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-age-max" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Max Age</label>
                          <input id="meta-age-max" type="number" value={metaAgeMax} onChange={(e) => setMetaAgeMax(Number(e.target.value))} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-gender" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Gender</label>
                          <select id="meta-gender" value={metaGender} onChange={(e) => setMetaGender(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none">
                            <option value="all">All</option>
                            <option value="men">Men Only</option>
                            <option value="women">Women Only</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="meta-interests" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Audience Interests (comma-separated)</label>
                          <input id="meta-interests" type="text" value={metaInterests} onChange={(e) => setMetaInterests(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-behaviors" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Audience Behaviors</label>
                          <input id="meta-behaviors" type="text" value={metaBehaviors} onChange={(e) => setMetaBehaviors(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="meta-job-titles" className="text-[10px] font-black text-neutral-600 block mb-1">Job Titles</label>
                          <input id="meta-job-titles" type="text" value={metaJobTitles} onChange={(e) => setMetaJobTitles(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-education" className="text-[10px] font-black text-neutral-600 block mb-1">Education Level</label>
                          <input id="meta-education" type="text" value={metaEducation} onChange={(e) => setMetaEducation(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-lookalike-pct" className="text-[10px] font-black text-neutral-600 block mb-1">Lookalike Size (%)</label>
                          <input id="meta-lookalike-pct" type="number" value={metaLookalikePct} onChange={(e) => setMetaLookalikePct(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="meta-include" className="text-[10px] font-black text-neutral-600 block mb-1">Include Audiences</label>
                          <input id="meta-include" type="text" value={metaInclude} onChange={(e) => setMetaInclude(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-exclude" className="text-[10px] font-black text-neutral-600 block mb-1">Exclude Audiences</label>
                          <input id="meta-exclude" type="text" value={metaExclude} onChange={(e) => setMetaExclude(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>
                      </div>

                      {/* Placements checkboxes */}
                      <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between border-b border-neutral-200 pb-2 mb-2">
                          <label htmlFor="meta-advantage-placements" className="text-[10px] font-black text-neutral-600 uppercase">Advantage+ Placements</label>
                          <input id="meta-advantage-placements" type="checkbox" checked={metaAdvantagePlacements} onChange={(e) => setMetaAdvantagePlacements(e.target.checked)} className="h-4 w-4 text-indigo-650" />
                        </div>

                        {!metaAdvantagePlacements && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-[11px] font-bold text-neutral-600">
                            {["Facebook Feed", "Instagram Feed", "Facebook Stories", "Instagram Stories", "Reels", "Explore", "Messenger", "Audience Network"].map(placement => (
                              <label key={placement} className="flex items-center gap-1.5 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={metaManualPlacements.includes(placement)}
                                  onChange={(e) => {
                                    if (e.target.checked) setMetaManualPlacements([...metaManualPlacements, placement]);
                                    else setMetaManualPlacements(metaManualPlacements.filter(p => p !== placement));
                                  }}
                                />
                                <span>{placement}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeFormTab === "keywords" && (
                    <div className="space-y-4">
                      
                      <div className="bg-neutral-50/50 border border-neutral-200 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-neutral-600 uppercase block border-b border-neutral-200 pb-1.5">Bidding Controls & Tracking</span>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label htmlFor="meta-bid-strategy" className="text-[10px] font-black text-neutral-500 block mb-1">Bid Strategy</label>
                            <select id="meta-bid-strategy" value={metaBidStrategy} onChange={(e) => setMetaBidStrategy(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none bg-white">
                              <option value="Highest volume">Highest volume</option>
                              <option value="Cost per result goal">Cost per result goal</option>
                              <option value="Bid cap">Bid cap</option>
                              <option value="ROAS Goal">ROAS Goal</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="meta-cost-cap" className="text-[10px] font-black text-neutral-500 block mb-1">Cost Cap ($)</label>
                            <input id="meta-cost-cap" type="number" step="0.5" value={metaCostCap} onChange={(e) => setMetaCostCap(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="meta-bid-cap" className="text-[10px] font-black text-neutral-500 block mb-1">Bid Cap ($)</label>
                            <input id="meta-bid-cap" type="number" step="0.5" value={metaBidCap} onChange={(e) => setMetaBidCap(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-1">
                          <div>
                            <label htmlFor="meta-freq-cap" className="text-[10px] font-black text-neutral-500 block mb-1">Frequency Cap</label>
                            <input id="meta-freq-cap" type="number" value={metaFreqCap} onChange={(e) => setMetaFreqCap(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="meta-opt-goal" className="text-[10px] font-black text-neutral-500 block mb-1">Optimization Goal</label>
                            <select id="meta-opt-goal" value={metaOptGoal} onChange={(e) => setMetaOptGoal(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none bg-white">
                              <option value="Leads">Leads</option>
                              <option value="Purchases">Purchases</option>
                              <option value="Link Clicks">Link Clicks</option>
                              <option value="Landing page views">Landing page views</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="meta-attribution" className="text-[10px] font-black text-neutral-500 block mb-1">Attribution Window</label>
                            <select id="meta-attribution" value={metaAttribution} onChange={(e) => setMetaAttribution(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none bg-white">
                              <option value="7-day click + 1-day view">7-day click + 1-day view</option>
                              <option value="1-day click">1-day click</option>
                              <option value="1-day click + 1-day view">1-day click + 1-day view</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="bg-neutral-50/50 border border-neutral-200 p-4 rounded-xl grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="meta-pixel-source" className="text-[10px] font-black text-neutral-500 block mb-1">Pixel Tracking Source</label>
                          <input id="meta-pixel-source" type="text" value={metaPixelSource} onChange={(e) => setMetaPixelSource(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="meta-conversion-event" className="text-[10px] font-black text-neutral-500 block mb-1">Conversion Event Type</label>
                          <select id="meta-conversion-event" value={metaConversionEvent} onChange={(e) => setMetaConversionEvent(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-250 rounded-lg focus:outline-none bg-white">
                            <option value="Lead">Lead</option>
                            <option value="Purchase">Purchase</option>
                            <option value="View Content">View Content</option>
                            <option value="Add to Cart">Add to Cart</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFormTab === "creative" && (
                    <div className="space-y-4">
                      
                      <div className="border border-neutral-200/60 p-4 rounded-xl space-y-4">
                        <span className="text-[10px] font-black text-neutral-600 uppercase block border-b border-neutral-100 pb-1.5">Creative Builder</span>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="meta-creative-format" className="text-[10px] font-black text-neutral-500 block mb-1">Format Type</label>
                            <select id="meta-creative-format" value={metaCreativeFormat} onChange={(e) => setMetaCreativeFormat(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none bg-white">
                              <option value="single image">Single Image</option>
                              <option value="video">Promotional Video</option>
                              <option value="carousel">Multi-Image Carousel</option>
                              <option value="collection">Product Collection</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="meta-creative-angle" className="text-[10px] font-black text-neutral-500 block mb-1">Creative Angle / Hook</label>
                            <select id="meta-creative-angle" value={metaCreativeAngle} onChange={(e) => setMetaCreativeAngle(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none bg-white">
                              <option value="Offer-based">Offer-based discount</option>
                              <option value="Problem-Solution">Problem-Solution hook</option>
                              <option value="Social Proof">Social Proof testimonials</option>
                              <option value="Urgency">Urgency / Limited time offer</option>
                              <option value="Educational">Educational benefit breakdown</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="meta-headline" className="text-[10px] font-black text-neutral-500 block mb-1">Headline Text</label>
                          <input id="meta-headline" type="text" value={metaHeadline} onChange={(e) => setMetaHeadline(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="meta-primary-text" className="text-[10px] font-black text-neutral-500 block mb-1">Primary Text Description</label>
                            <textarea id="meta-primary-text" value={metaPrimaryText} onChange={(e) => setMetaPrimaryText(e.target.value)} rows={3} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="meta-desc" className="text-[10px] font-black text-neutral-500 block mb-1">Feed Description</label>
                            <textarea id="meta-desc" value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={3} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="meta-cta" className="text-[10px] font-black text-neutral-500 block mb-1">Call to Action (CTA)</label>
                            <select id="meta-cta" value={metaCta} onChange={(e) => setMetaCta(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none bg-white">
                              <option value="LEARN_MORE">Learn More</option>
                              <option value="SIGN_UP">Sign Up</option>
                              <option value="SHOP_NOW">Shop Now</option>
                              <option value="DOWNLOAD">Download</option>
                              <option value="CONTACT_US">Contact Us</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="meta-landing-page" className="text-[10px] font-black text-neutral-500 block mb-1">Destination URL</label>
                            <input id="meta-landing-page" type="text" value={metaLandingPage} onChange={(e) => setMetaLandingPage(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="meta-url-params" className="text-[10px] font-black text-neutral-500 block mb-1">URL Parameters (Tracking)</label>
                          <input id="meta-url-params" type="text" value={metaUrlParams} onChange={(e) => setMetaUrlParams(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* SEO VIEW */}
              {mode === "SEO" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  
                  {activeFormTab === "setup" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="seo-project-name" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Project Name</label>
                          <input id="seo-project-name" type="text" value={seoProjectName} onChange={(e) => setSeoProjectName(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="seo-website-url" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Website Domain URL</label>
                          <input id="seo-website-url" type="text" value={seoWebsiteUrl} onChange={(e) => setSeoWebsiteUrl(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="seo-page-type" className="text-[10px] font-black text-neutral-600 block mb-1">Page Type</label>
                          <select id="seo-page-type" value={seoPageType} onChange={(e) => setSeoPageType(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg bg-white focus:outline-none">
                            <option value="Landing Page">Landing Page</option>
                            <option value="Blog Post">Blog Post</option>
                            <option value="Category Page">Category Page</option>
                            <option value="Product Page">Product Page</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="seo-industry" className="text-[10px] font-black text-neutral-600 block mb-1">Industry</label>
                          <input id="seo-industry" type="text" value={seoIndustry} onChange={(e) => setSeoIndustry(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="seo-objective" className="text-[10px] font-black text-neutral-600 block mb-1">SEO Objective</label>
                          <select id="seo-objective" value={seoObjective} onChange={(e) => setSeoObjective(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg bg-white focus:outline-none">
                            <option value="Traffic Growth">Traffic Growth</option>
                            <option value="Lead Generation">Lead Generation</option>
                            <option value="E-commerce Sales">E-commerce Sales</option>
                            <option value="Local Ranking">Local Ranking</option>
                          </select>
                        </div>
                      </div>

                      <div className="border border-neutral-200/60 p-4 rounded-xl space-y-3 bg-neutral-50/40">
                        <span className="text-[10px] font-black text-neutral-600 uppercase block border-b border-neutral-100 pb-1.5">Keyword Research Tool</span>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="seo-primary-keyword" className="text-[10px] font-black text-neutral-500 block mb-1">Primary Keyword</label>
                            <input id="seo-primary-keyword" type="text" value={seoPrimaryKeyword} onChange={(e) => setSeoPrimaryKeyword(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none bg-white" />
                          </div>
                          <div>
                            <label htmlFor="seo-keywords" className="text-[10px] font-black text-neutral-500 block mb-1">Secondary Keywords (comma-separated)</label>
                            <input id="seo-keywords" type="text" value={seoSecondaryKeywordsInput} onChange={(e) => setSeoTargetKeywordsInput(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none bg-white" />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 pt-1">
                          <div>
                            <label htmlFor="seo-search-intent" className="text-[10px] font-black text-neutral-500 block mb-1">Search Intent</label>
                            <select id="seo-search-intent" value={seoSearchIntent} onChange={(e) => setSeoSearchIntent(e.target.value)} className="w-full px-3 py-1 text-xs font-bold border border-neutral-200 rounded-lg bg-white focus:outline-none">
                              <option value="commercial">Commercial</option>
                              <option value="transactional">Transactional</option>
                              <option value="informational">Informational</option>
                              <option value="navigational">Navigational</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="seo-difficulty" className="text-[10px] font-black text-neutral-500 block mb-1">Difficulty (0-100)</label>
                            <input id="seo-difficulty" type="number" value={seoKeywordDifficulty} onChange={(e) => setSeoKeywordDifficulty(Number(e.target.value))} className="w-full px-3 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="seo-volume" className="text-[10px] font-black text-neutral-500 block mb-1">Volume (monthly)</label>
                            <input id="seo-volume" type="number" value={seoSearchVolume} onChange={(e) => setSeoSearchVolume(Number(e.target.value))} className="w-full px-3 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="seo-priority" className="text-[10px] font-black text-neutral-500 block mb-1">Priority Score</label>
                            <input id="seo-priority" type="number" value={seoPriorityScore} onChange={(e) => setSeoPriorityScore(Number(e.target.value))} className="w-full px-3 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFormTab === "targeting" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="seo-country" className="text-[10px] font-black text-neutral-600 block mb-1">Target Country / Location</label>
                          <input id="seo-country" type="text" value={seoTargetCountry} onChange={(e) => setSeoTargetCountry(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="seo-audience" className="text-[10px] font-black text-neutral-600 block mb-1">Target Audience Profile</label>
                          <input id="seo-audience" type="text" value={seoTargetAudience} onChange={(e) => setSeoTargetAudience(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>
                      </div>

                      {/* Technical SEO Panel */}
                      <div className="bg-neutral-50 border border-neutral-200/60 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-neutral-600 uppercase block border-b border-neutral-200 pb-1.5">Technical & Web Vitals Config</span>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs font-bold text-neutral-700">
                          <div className="space-y-2">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={seoTechnicalSSL} onChange={(e) => setSeoTechnicalSSL(e.target.checked)} />
                              <span>SSL Enabled (HTTPS)</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={seoTechnicalSitemap} onChange={(e) => setSeoTechnicalSitemap(e.target.checked)} />
                              <span>XML Sitemap Configured</span>
                            </label>
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={seoTechnicalMobile} onChange={(e) => setSeoTechnicalMobile(e.target.checked)} />
                              <span>Mobile Friendly Design</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox" checked={seoTechnicalRobots} onChange={(e) => setSeoTechnicalRobots(e.target.checked)} />
                              <span>robots.txt Configured</span>
                            </label>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3 pt-2">
                          <div>
                            <label htmlFor="seo-speed" className="text-[10px] font-black text-neutral-500 block mb-1">Page Speed (0-100)</label>
                            <input id="seo-speed" type="number" value={seoPageSpeed} onChange={(e) => setSeoPageSpeed(Number(e.target.value))} className="w-full px-2 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="seo-lcp" className="text-[10px] font-black text-neutral-500 block mb-1">LCP (Seconds)</label>
                            <input id="seo-lcp" type="number" step="0.1" value={seoLcp} onChange={(e) => setSeoLcp(Number(e.target.value))} className="w-full px-2 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="seo-cls" className="text-[10px] font-black text-neutral-500 block mb-1">CLS index</label>
                            <input id="seo-cls" type="number" step="0.01" value={seoCls} onChange={(e) => setSeoCls(Number(e.target.value))} className="w-full px-2 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="seo-inp" className="text-[10px] font-black text-neutral-500 block mb-1">INP (ms)</label>
                            <input id="seo-inp" type="number" value={seoInp} onChange={(e) => setSeoInp(Number(e.target.value))} className="w-full px-2 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFormTab === "keywords" && (
                    <div className="space-y-4">
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="seo-meta-title" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Meta Page Title</label>
                          <input 
                            id="seo-meta-title"
                            name="seoMetaTitle"
                            type="text" 
                            value={seoMetaTitle} 
                            onChange={(e) => setSeoMetaTitle(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="seo-url-slug" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">URL Slug</label>
                          <input 
                            id="seo-url-slug"
                            name="seoUrlSlug"
                            type="text" 
                            value={seoUrlSlug} 
                            onChange={(e) => setSeoUrlSlug(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="seo-meta-description" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Meta Description (120-160 characters)</label>
                        <input 
                          id="seo-meta-description"
                          name="seoMetaDescription"
                          type="text" 
                          value={seoMetaDescription} 
                          onChange={(e) => setSeoMetaDescription(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="seo-h1" className="text-[10px] font-black text-neutral-600 block mb-1">H1 Main Heading</label>
                          <input id="seo-h1" type="text" value={seoH1} onChange={(e) => setSeoH1(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="seo-h2-h3" className="text-[10px] font-black text-neutral-600 block mb-1">H2 & H3 Outline</label>
                          <input id="seo-h2-h3" type="text" value={seoH2H3Outline} onChange={(e) => setSeoH2H3Outline(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="seo-body-content" className="text-[10px] font-black text-neutral-600 uppercase block mb-1">Content Body Content (Optimized Density)</label>
                        <textarea 
                          id="seo-body-content"
                          name="seoBodyContent"
                          value={seoBodyContent} 
                          onChange={(e) => setSeoBodyContent(e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 text-xs font-bold border border-neutral-205 rounded-xl focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {activeFormTab === "creative" && (
                    <div className="space-y-4">
                      
                      <div className="bg-neutral-50/50 border border-neutral-200 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-neutral-600 uppercase block border-b border-neutral-200 pb-1.5">Internal Linking & Backlink Strategy</span>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label htmlFor="seo-link-source" className="text-[10px] font-black text-neutral-500 block mb-1">Source Page</label>
                            <input id="seo-link-source" type="text" value={seoInternalLinksSource} onChange={(e) => setSeoInternalLinksSource(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="seo-link-target" className="text-[10px] font-black text-neutral-500 block mb-1">Target Page</label>
                            <input id="seo-link-target" type="text" value={seoInternalLinksTarget} onChange={(e) => setSeoInternalLinksTarget(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="seo-link-anchor" className="text-[10px] font-black text-neutral-500 block mb-1">Anchor Text</label>
                            <input id="seo-link-anchor" type="text" value={seoInternalLinksAnchor} onChange={(e) => setSeoInternalLinksAnchor(e.target.value)} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-1">
                          <div>
                            <label htmlFor="seo-backlink-budget" className="text-[10px] font-black text-neutral-500 block mb-1">Backlink Budget ($)</label>
                            <input id="seo-backlink-budget" type="number" value={seoBacklinkBudget} onChange={(e) => setSeoBacklinkBudget(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="seo-backlink-quality" className="text-[10px] font-black text-neutral-500 block mb-1">Backlink Quality</label>
                            <select id="seo-backlink-quality" value={seoBacklinkQuality} onChange={(e) => setSeoBacklinkQuality(Number(e.target.value))} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 rounded-lg bg-white focus:outline-none">
                              <option value={1}>Low Quality Links</option>
                              <option value={2}>Medium Quality Links</option>
                              <option value={3}>High Quality Guest Posts</option>
                            </select>
                          </div>
                          <div>
                            <label htmlFor="seo-toxic" className="text-[10px] font-black text-neutral-500 block mb-1">Toxic Links Risk</label>
                            <input id="seo-toxic" type="number" readOnly value={seoToxicLinkRisk} className="w-full px-3 py-1.5 text-xs font-bold border border-neutral-200 bg-neutral-100 cursor-not-allowed rounded-lg focus:outline-none" />
                          </div>
                        </div>
                      </div>

                      <div className="border border-neutral-200/60 p-4 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-neutral-600 uppercase block border-b border-neutral-100 pb-1.5 font-bold">Competitor Benchmark</span>
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <label htmlFor="seo-comp-domain" className="text-[10px] font-black text-neutral-500 block mb-1">Competitor Domain</label>
                            <input id="seo-comp-domain" type="text" value={seoCompetitorDomain} onChange={(e) => setSeoCompetitorDomain(e.target.value)} className="w-full px-2 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="seo-comp-rank" className="text-[10px] font-black text-neutral-500 block mb-1">Competitor Rank</label>
                            <input id="seo-comp-rank" type="number" value={seoCompetitorRank} onChange={(e) => setSeoCompetitorRank(Number(e.target.value))} className="w-full px-2 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="seo-comp-content" className="text-[10px] font-black text-neutral-500 block mb-1">Content Score</label>
                            <input id="seo-comp-content" type="number" value={seoCompetitorContentScore} onChange={(e) => setSeoCompetitorContentScore(Number(e.target.value))} className="w-full px-2 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                          <div>
                            <label htmlFor="seo-comp-auth" className="text-[10px] font-black text-neutral-500 block mb-1">Authority Score</label>
                            <input id="seo-comp-auth" type="number" value={seoCompetitorAuthorityScore} onChange={(e) => setSeoCompetitorAuthorityScore(Number(e.target.value))} className="w-full px-2 py-1 text-xs font-bold border border-neutral-200 rounded-lg focus:outline-none" />
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* SAVE / RUN BUTTONS */}
              <div className="flex justify-between items-center pt-4 border-t border-neutral-100">
                <Button onClick={handleSaveDecision} className="bg-neutral-800 hover:bg-neutral-900 text-white font-black text-xs px-6 h-10 rounded-xl">
                  Save Settings Draft
                </Button>
                
                <Button 
                  onClick={handleRunSimulation}
                  className="bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs px-6 h-10 rounded-xl flex items-center gap-1.5"
                >
                  <Play className="h-4 w-4 fill-white" />
                  Run Campaign Simulation
                </Button>
              </div>

            </Card>
          ) : (
            <Card className="p-6 border-neutral-250 bg-neutral-50/50 text-center space-y-4 shadow-sm">
              <Clock className="h-12 w-12 text-indigo-650 mx-auto animate-pulse" />
              <h2 className="text-sm font-black text-neutral-850">
                {isCompleted 
                  ? "Simulation Campaign Completed" 
                  : isProcessing 
                  ? "Pacing calculations are running..." 
                  : "Round complete: awaiting next cycle"}
              </h2>
              <p className="text-xs text-neutral-450 font-semibold max-w-sm mx-auto leading-relaxed">
                {isCompleted 
                  ? "You have completed all days in this campaign path. Check your final score and issue your certificate!" 
                  : isProcessing 
                  ? "Your daily settings are locked. Results will populate instantly or at the next scheduled refresh interval." 
                  : "You have completed this round's execution cycle. Review the report or start the next cycle."}
              </p>
              
              {!isCompleted && !isProcessing && isResultsReady && (
                <div className="flex justify-center gap-4 pt-2">
                  <Button onClick={handleNextRound} className="bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs px-6 h-10 rounded-xl">
                    Begin Next Round Cycle
                  </Button>
                  
                  {process.env.NODE_ENV !== "production" && (
                    <Button onClick={handleFastForward} className="bg-neutral-800 hover:bg-neutral-900 text-white font-black text-xs px-6 h-10 rounded-xl">
                      Fast-Forward processing (Dev Mode)
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Mode Specific Results Output */}
          {report && (
            <Card className="p-6 border-neutral-200 shadow-sm bg-white space-y-6">
              <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                <BarChart3 className="h-5 w-5 text-indigo-650" />
                <h2 className="text-base font-black text-neutral-900">Simulation Campaign Performance Report</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/50">
                  <span className="text-[9px] text-neutral-400 font-bold block uppercase">Impressions</span>
                  <span className="text-sm font-black text-neutral-850 block mt-0.5">{report.summary.impressions.toLocaleString()}</span>
                </div>
                <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/50">
                  <span className="text-[9px] text-neutral-400 font-bold block uppercase">Clicks</span>
                  <span className="text-sm font-black text-neutral-850 block mt-0.5">{report.summary.clicks.toLocaleString()}</span>
                </div>
                <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/50">
                  <span className="text-[9px] text-neutral-400 font-bold block uppercase">Conversions</span>
                  <span className="text-sm font-black text-neutral-850 block mt-0.5">{report.summary.conversions.toLocaleString()}</span>
                </div>
                <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/50">
                  <span className="text-[9px] text-neutral-400 font-bold block uppercase">Total Spend</span>
                  <span className="text-sm font-black text-rose-600 block mt-0.5">${report.summary.cost.toLocaleString()}</span>
                </div>
                <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-200/50">
                  <span className="text-[9px] text-neutral-400 font-bold block uppercase">Revenue</span>
                  <span className="text-sm font-black text-emerald-600 block mt-0.5">${report.summary.revenue.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="border border-neutral-200/60 p-3.5 rounded-xl">
                  <span className="text-[9px] text-neutral-400 font-bold block uppercase">CTR</span>
                  <span className="text-xs font-black text-neutral-800 block mt-0.5">{(report.summary.ctr * 100).toFixed(2)}%</span>
                </div>
                <div className="border border-neutral-200/60 p-3.5 rounded-xl">
                  <span className="text-[9px] text-neutral-400 font-bold block uppercase">Avg CPC</span>
                  <span className="text-xs font-black text-neutral-800 block mt-0.5">${report.summary.cpc.toFixed(2)}</span>
                </div>
                <div className="border border-neutral-200/60 p-3.5 rounded-xl">
                  <span className="text-[9px] text-neutral-400 font-bold block uppercase">Avg CPA</span>
                  <span className="text-xs font-black text-neutral-800 block mt-0.5">${report.summary.cpa.toFixed(2)}</span>
                </div>
                <div className="border border-neutral-200/60 p-3.5 rounded-xl">
                  <span className="text-[9px] text-neutral-400 font-bold block uppercase">ROAS</span>
                  <span className="text-xs font-black text-neutral-800 block mt-0.5">{report.summary.roas.toFixed(2)}x</span>
                </div>
              </div>

              {/* Mode specific table reporting */}
              {mode === "GOOGLE_ADS" && (
                <div className="space-y-4 pt-4 border-t border-neutral-100">
                  <span className="text-xs font-black text-neutral-800 block">Google Search Terms Performance</span>
                  <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                    <table className="w-full text-left text-xs font-medium text-neutral-600">
                      <thead className="bg-neutral-50 text-[10px] text-neutral-400 font-black uppercase border-b border-neutral-200">
                        <tr>
                          <th className="p-3">Search Query</th>
                          <th className="p-3">Match</th>
                          <th className="p-3 text-right">Impressions</th>
                          <th className="p-3 text-right">Clicks</th>
                          <th className="p-3 text-right">Spend</th>
                          <th className="p-3 text-right">Conversions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-semibold text-neutral-700">
                        <tr>
                          <td className="p-3 font-bold text-neutral-900">{googleKeywordsInput.split(',')[0] || "crm software"}</td>
                          <td className="p-3 capitalize">{googleMatchType}</td>
                          <td className="p-3 text-right">{(report.summary.impressions * 0.6).toFixed(0)}</td>
                          <td className="p-3 text-right">{(report.summary.clicks * 0.6).toFixed(0)}</td>
                          <td className="p-3 text-right">${(report.summary.cost * 0.6).toFixed(2)}</td>
                          <td className="p-3 text-right">{(report.summary.conversions * 0.6).toFixed(0)}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-neutral-900">{googleKeywordsInput.split(',')[1] || "sales pipeline"}</td>
                          <td className="p-3 capitalize">{googleMatchType}</td>
                          <td className="p-3 text-right">{(report.summary.impressions * 0.4).toFixed(0)}</td>
                          <td className="p-3 text-right">{(report.summary.clicks * 0.4).toFixed(0)}</td>
                          <td className="p-3 text-right">${(report.summary.cost * 0.4).toFixed(2)}</td>
                          <td className="p-3 text-right">{(report.summary.conversions * 0.4).toFixed(0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {mode === "META_ADS" && (
                <div className="space-y-4 pt-4 border-t border-neutral-100">
                  <span className="text-xs font-black text-neutral-800 block">Placement Allocation Analysis</span>
                  <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                    <table className="w-full text-left text-xs font-medium text-neutral-600">
                      <thead className="bg-neutral-50 text-[10px] text-neutral-400 font-black uppercase border-b border-neutral-200">
                        <tr>
                          <th className="p-3">Placement</th>
                          <th className="p-3 text-right">Impressions</th>
                          <th className="p-3 text-right">CPM ($)</th>
                          <th className="p-3 text-right">Clicks</th>
                          <th className="p-3 text-right">Spend</th>
                          <th className="p-3 text-right">Purchases</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-semibold text-neutral-700">
                        <tr>
                          <td className="p-3 font-bold text-neutral-900">Facebook Feeds</td>
                          <td className="p-3 text-right">{(report.summary.impressions * 0.5).toFixed(0)}</td>
                          <td className="p-3 text-right">$14.50</td>
                          <td className="p-3 text-right">{(report.summary.clicks * 0.45).toFixed(0)}</td>
                          <td className="p-3 text-right">${(report.summary.cost * 0.5).toFixed(2)}</td>
                          <td className="p-3 text-right">{(report.summary.conversions * 0.5).toFixed(0)}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-neutral-900">Instagram Stories & Reels</td>
                          <td className="p-3 text-right">{(report.summary.impressions * 0.5).toFixed(0)}</td>
                          <td className="p-3 text-right">$12.00</td>
                          <td className="p-3 text-right">{(report.summary.clicks * 0.55).toFixed(0)}</td>
                          <td className="p-3 text-right">${(report.summary.cost * 0.5).toFixed(2)}</td>
                          <td className="p-3 text-right">{(report.summary.conversions * 0.5).toFixed(0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {mode === "SEO" && (
                <div className="space-y-4 pt-4 border-t border-neutral-100">
                  <span className="text-xs font-black text-neutral-800 block">Keyword Rankings & Visibility index</span>
                  <div className="overflow-x-auto border border-neutral-200 rounded-xl">
                    <table className="w-full text-left text-xs font-medium text-neutral-600">
                      <thead className="bg-neutral-50 text-[10px] text-neutral-400 font-black uppercase border-b border-neutral-200">
                        <tr>
                          <th className="p-3">Keyword</th>
                          <th className="p-3 text-center">SERP Rank</th>
                          <th className="p-3 text-right">Search Volume</th>
                          <th className="p-3 text-right">Clicks</th>
                          <th className="p-3 text-right">CTR</th>
                          <th className="p-3">Intent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-semibold text-neutral-700">
                        <tr>
                          <td className="p-3 font-bold text-neutral-900">{seoPrimaryKeyword}</td>
                          <td className="p-3 text-center text-indigo-650 font-black">#3</td>
                          <td className="p-3 text-right">{seoSearchVolume}</td>
                          <td className="p-3 text-right">{(report.summary.clicks * 0.7).toFixed(0)}</td>
                          <td className="p-3 text-right">9.80%</td>
                          <td className="p-3 capitalize">{seoSearchIntent}</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold text-neutral-900">{seoSecondaryKeywordsInput.split(',')[0] || "CRM software tool"}</td>
                          <td className="p-3 text-center text-indigo-650 font-black">#8</td>
                          <td className="p-3 text-right">800</td>
                          <td className="p-3 text-right">{(report.summary.clicks * 0.3).toFixed(0)}</td>
                          <td className="p-3 text-right">2.40%</td>
                          <td className="p-3 capitalize">Commercial</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sandbox Recommendations */}
              {report.recommendations && report.recommendations.length > 0 && (
                <div className="bg-amber-50/30 border border-amber-100/60 rounded-2xl p-5 space-y-3 animate-in fade-in duration-300">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2.5 py-1 rounded-full flex items-center gap-1.5 w-max">
                    <Sparkles className="h-3.5 w-3.5 fill-amber-600 text-amber-600" />
                    Recommendations & Coach Advice
                  </span>
                  
                  <ul className="space-y-2 text-[11px] text-neutral-600 font-semibold list-disc pl-4">
                    {report.recommendations.map((rec: string, index: number) => (
                      <li key={index} className="leading-relaxed">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

        </div>

        {/* Locked Delay Timer & Certs */}
        <div className="space-y-6 text-left">
          
          {/* Active Campaign Card */}
          <Card className="border border-neutral-200 bg-white p-6 space-y-4 shadow-sm">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Campaign Overview</span>
            
            <div className="divide-y divide-neutral-100 text-xs">
              <div className="py-2.5 flex justify-between items-center font-semibold">
                <span className="text-neutral-500">Selected Simulation Type</span>
                <Badge className="bg-indigo-50 text-indigo-850 border-none font-bold uppercase text-[9px]">{mode.replace('_', ' ')}</Badge>
              </div>
              <div className="py-2.5 flex justify-between items-center font-semibold">
                <span className="text-neutral-500">Selected Scenario</span>
                <span className="text-neutral-800 font-black truncate max-w-[150px]">{state.class?.scenario?.name}</span>
              </div>
              <div className="py-2.5 flex justify-between items-center font-semibold">
                <span className="text-neutral-500">Timing / Duration</span>
                <span className="text-neutral-800 font-black">{state.class?.scenario?.maxRounds} days total</span>
              </div>
              
              {progress?.nextResultAt && (
                <div className="py-2.5 flex justify-between items-center font-semibold text-amber-600">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Next Result Unlock</span>
                  <span className="font-black text-[10px]">{new Date(progress.nextResultAt).toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            <Button onClick={handleResetSandbox} className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs h-9 rounded-xl border border-rose-200/50">
              Reset Sandbox Console
            </Button>
          </Card>

          {/* Certificate Award section */}
          {isCompleted && certEligible && (
            <Card className="p-6 border-violet-200 shadow-md bg-violet-50/20 text-left space-y-4 animate-in fade-in duration-300">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-violet-650 uppercase tracking-widest bg-violet-50 px-2.5 py-1 rounded-full flex items-center gap-1.5 w-max">
                  <Sparkles className="h-3.5 w-3.5 fill-violet-650" />
                  Graduation Status
                </span>
                <h2 className="text-sm font-black text-neutral-900 mt-2">
                  {certEligible.eligible ? `Eligible: ${certEligible.band} Certificate` : 'Graduation Requirements'}
                </h2>
                <p className="text-[11px] text-neutral-500 font-semibold leading-relaxed">
                  Sandbox learners qualify for certification by achieving a composite index $\ge 60$ and an adaptability rating $\ge 50$.
                </p>
              </div>

              {certEligible.eligible ? (
                <Button onClick={handleGenerateCertificate} className="w-full bg-violet-650 hover:bg-violet-755 text-white font-black text-xs h-10 rounded-xl flex items-center justify-center gap-2">
                  <Download className="h-4 w-4" />
                  Issue Certificate PDF
                </Button>
              ) : (
                <div className="space-y-2">
                  <Badge className="bg-rose-50 text-rose-800 border border-rose-200 font-black text-[10px]">Not Eligible Yet</Badge>
                  {certEligible.reasons && certEligible.reasons.length > 0 && (
                    <ul className="list-disc pl-4 space-y-1 text-[10px] text-rose-700 font-semibold">
                      {certEligible.reasons.map((r: string, index: number) => (
                        <li key={index}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          )}

        </div>

      </div>

    </div>
  )
}
