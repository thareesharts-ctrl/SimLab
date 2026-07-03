import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import { Card, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { toast } from "sonner"
import { 
  Play, Activity, Award, BookOpen, 
  MapPin, CheckCircle, RefreshCw, ShieldAlert,
  Settings, Clock, Sparkles, Download, ArrowRight,
  TrendingUp
} from "lucide-react"

export function SimulationHomePage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [fullState, setFullState] = useState<any>(null)
  const [progressState, setProgressState] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isInitializingPath, setIsInitializingPath] = useState(false)

  // Onboarding Setup Steps
  const [selectedMode, setSelectedMode] = useState<"GOOGLE_ADS" | "META_ADS" | "SEO">("GOOGLE_ADS")
  const [scenarioChoice, setScenarioChoice] = useState<"sample" | "custom">("sample")
  
  // Preset scenarios list
  const [sampleScenarios, setSampleScenarios] = useState<any[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState("")
  const [sampleScenariosError, setSampleScenariosError] = useState(false)

  // Custom Scenario States
  const [scenarioName, setScenarioName] = useState("Custom Campaign Sandbox")
  const [industry, setIndustry] = useState("Technology")
  const [businessType, setBusinessType] = useState("B2B SaaS")
  const [targetAudience, setTargetAudience] = useState("tech professionals")
  const [targetLocation, setTargetLocation] = useState("Global")
  const [objectiveKPI, setObjectiveKPI] = useState("revenue") // revenue, clicks, conversions
  const [competitionLevel, setCompetitionLevel] = useState("medium") // easy, medium, hard
  const [productDescription, setProductDescription] = useState("Collaborative team cloud pipeline manager tool.")

  // Timing/Duration States
  const [timingMode, setTimingMode] = useState<"instant" | "24h" | "custom">("instant")
  const [customHours, setCustomHours] = useState(24)
  const [durationDays, setDurationDays] = useState(15) // number of days / rounds

  // Certificate check states
  const [certEligible, setCertEligible] = useState<any>(null)
  const [checkingCert, setCheckingCert] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await api.get<{ success: boolean; hasState: boolean; state: any; progress?: any }>('/api/v1/sandbox/state')
      if (res.data?.success && res.data.hasState) {
        setFullState(res.data.state)
        setProgressState(res.data.progress)
        
        if (res.data.state.isCompleted || res.data.state.status === 'COMPLETED' || res.data.state.status === 'SCORE_LOCKED') {
          await loadCertCheck()
        }
      } else {
        setFullState(null)
        await loadSampleScenarios(selectedMode)
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.response?.data?.message || "Please start a new sandbox simulation.")
    } finally {
      setLoading(false)
    }
  }

  const loadSampleScenarios = async (mode: string) => {
    try {
      setSampleScenariosError(false)
      const res = await api.get<any>(`/api/v1/sandbox/sample-scenarios?mode=${mode}`)
      if (res.data?.success) {
        setSampleScenarios(res.data.presetScenarios || [])
        if (res.data.presetScenarios?.length > 0) {
          setSelectedScenarioId(res.data.presetScenarios[0].id)
        }
      }
    } catch (e) {
      console.error("Failed to load sample scenarios", e)
      setSampleScenariosError(true)
    }
  }

  const loadCertCheck = async () => {
    try {
      setCheckingCert(true)
      const res = await api.get<any>('/api/v1/sandbox/certificate/check')
      if (res.data?.success) {
        setCertEligible(res.data)
      }
    } catch (e) {
      console.error("Certificate check error", e)
    } finally {
      setCheckingCert(false)
    }
  }

  const handleGenerateCert = async () => {
    const tid = toast.loading("Generating certificate PDF...")
    try {
      const res = await api.post<any>('/api/v1/sandbox/certificate/generate')
      if (res.data?.success) {
        toast.success("Certificate issued successfully!", { id: tid })
        window.open(res.data.downloadUrl, '_blank')
        await loadCertCheck()
      } else {
        toast.error("Failed to generate certificate.", { id: tid })
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Not eligible yet.", { id: tid })
    }
  }

  const handleStartSimulation = async () => {
    setIsInitializingPath(true)
    const tid = toast.loading(`Starting ${selectedMode} simulation...`)
    try {
      const isAdmin = user?.role === "admin";
      
      const payload: any = {
        simulationMode: selectedMode,
        scenarioType: scenarioChoice === "custom" ? "CUSTOM" : "SAMPLE",
        durationDays: durationDays,
      }

      if (scenarioChoice === "custom") {
        payload.customScenario = {
          scenarioName,
          industry,
          businessType,
          targetAudience,
          location: targetLocation,
          objectiveKPI,
          competitionLevel,
          productDescription
        }
        payload.resultCycleHours = timingMode === "instant" ? 0 : (timingMode === "custom" ? customHours : 24)
        payload.timingMode = timingMode
      } else {
        payload.scenarioId = selectedScenarioId
        payload.timingMode = isAdmin ? "instant" : "24h"
      }

      const startRes = await api.post<any>('/api/v1/sandbox/start', payload)
      if (startRes.data?.success) {
        toast.success(`Successfully initialized sandbox simulation!`, { id: tid })
        navigate(`/sandbox/workspace?mode=${selectedMode}`)
      } else {
        toast.error("Failed to start sandbox simulation.", { id: tid })
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || err.message || "Failed to start simulation.", { id: tid })
    } finally {
      setIsInitializingPath(false)
    }
  }

  const handleResetSandbox = async () => {
    if (confirm("Are you sure you want to delete current progress and restart sandbox?")) {
      const tid = toast.loading("Clearing simulation workspace...")
      try {
        // We delete by starting a fresh onboarding flow
        setFullState(null)
        setProgressState(null)
        await loadSampleScenarios(selectedMode)
        toast.success("Workspace cleared. Ready to configure new campaign.", { id: tid })
      } catch (e) {
        toast.error("Failed to reset sandbox.", { id: tid })
      }
    }
  }

  // Reload presets if mode changes
  useEffect(() => {
    loadSampleScenarios(selectedMode)
  }, [selectedMode])

  useEffect(() => {
    if (user?.role === "instructor" || user?.role === "INSTRUCTOR") {
      navigate("/instructor");
      return;
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin" />
        <span className="text-sm text-neutral-500 font-bold">Loading sandbox console...</span>
      </div>
    )
  }

  const isAdmin = user?.role === "admin";
  const isIndividual = user?.role === "individual" || user?.role === "instructor" || user?.role === "admin";

  if (errorMsg && isIndividual) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-white border border-neutral-200 rounded-2xl shadow-sm text-center space-y-4">
        <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto animate-pulse" />
        <h2 className="text-lg font-black text-neutral-900">Sandbox Connection Error</h2>
        <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
          {errorMsg}
        </p>
        <Button 
          onClick={() => {
            setErrorMsg(null);
            loadData();
          }}
          className="bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold px-4 h-9 rounded-xl mx-auto flex items-center gap-1.5"
        >
          <RefreshCw className="h-4 w-4 animate-spin" style={{ animationDuration: '3s' }} />
          Retry Connection
        </Button>
      </div>
    )
  }

  // --- ACTIVE WORKSPACE PREVIEW CARD ---
  if (fullState) {
    const activeMode = fullState.simulationMode || "GOOGLE_ADS"
    const scenario = fullState.class?.scenario
    const progress = progressState || fullState.progress
    const currentRound = fullState.currentRound || 1
    const maxRounds = scenario?.maxRounds || 10
    const isCompleted = fullState.isCompleted || fullState.status === "COMPLETED" || fullState.status === "SCORE_LOCKED"
    const isProcessing = fullState.status === "PROCESSING" || progress?.status === "PROCESSING"

    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8 space-y-6 animate-in fade-in duration-300">
        <div className="text-left space-y-2 border-b border-neutral-100 pb-5">
          <Badge className="bg-indigo-50 text-indigo-900 border-none uppercase text-[9px] font-black tracking-widest px-2.5 py-1">
            Sandbox Manager
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900">
            Your Simulation Session is Active
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 font-semibold">
            You have an ongoing sandbox campaign run. Open your workspace to configure bids, upload ad copy, or optimize search keywords.
          </p>
        </div>

        {/* Sandbox Simulation Status Summary */}
        <Card className="p-6 border-neutral-200/80 shadow-md bg-white text-left space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-black text-neutral-400 uppercase block">Active Scenario</span>
              <CardTitle className="text-lg font-black text-neutral-900 mt-0.5">
                {scenario?.name}
              </CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetSandbox} className="text-xs border-neutral-200 rounded-xl">
              Reset Session
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-neutral-150 text-xs">
            <div>
              <span className="text-[10px] text-neutral-450 font-semibold block">Selected Simulation Type</span>
              <span className="text-neutral-800 font-black block mt-0.5">{activeMode.replace('_', ' ')}</span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-450 font-semibold block">Selected Scenario</span>
              <span className="text-neutral-850 font-black block mt-0.5 truncate max-w-[150px]">{scenario?.name}</span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-450 font-semibold block">Timing / Duration</span>
              <span className="text-neutral-800 font-black block mt-0.5">{maxRounds} days total</span>
            </div>
            <div>
              <span className="text-[10px] text-neutral-450 font-semibold block">Current Round / Day</span>
              <span className="text-indigo-650 font-black block mt-0.5">Round {currentRound} of {maxRounds}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs pt-4 border-t border-neutral-100">
            <div>
              <span className="text-[10px] text-neutral-450 font-semibold block">Status</span>
              {isProcessing ? (
                <span className="text-amber-600 font-bold block mt-0.5 animate-pulse">Processing settings...</span>
              ) : isCompleted ? (
                <span className="text-rose-600 font-bold block mt-0.5">Completed</span>
              ) : (
                <span className="text-emerald-600 font-bold block mt-0.5">Ready for Decisions</span>
              )}
            </div>
            <div>
              <span className="text-[10px] text-neutral-450 font-semibold block">Score</span>
              <span className="text-neutral-800 font-black block mt-0.5">{fullState.score || 0}%</span>
            </div>
            {progress?.nextResultAt && (
              <div className="col-span-2">
                <span className="text-[10px] text-neutral-450 font-semibold block">Next Result Time</span>
                <span className="text-indigo-650 font-black block mt-0.5">{new Date(progress.nextResultAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              onClick={() => navigate(`/sandbox/workspace?mode=${activeMode}`)}
              className="bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs px-6 h-10 rounded-xl flex items-center gap-1"
            >
              Open Campaign Workspace
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* Certificate Section */}
        {isCompleted && certEligible && (
          <Card className="p-6 border-violet-200 shadow-md bg-violet-50/20 text-left space-y-4 animate-in fade-in duration-300">
            <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-violet-650 uppercase tracking-widest bg-violet-55 px-2.5 py-1 rounded-full flex items-center gap-1.5 w-max">
                  <Sparkles className="h-3.5 w-3.5 fill-violet-650" />
                  Graduation Certificate Status
                </span>
                <h2 className="text-sm font-black text-neutral-900 mt-2">
                  {certEligible.eligible ? `Eligible: ${certEligible.band} Certification` : 'Graduation Check'}
                </h2>
                <p className="text-[11px] text-neutral-500 font-medium">
                  Certificates are awarded based on campaign performance score $\ge 60\%$ and adaptability index $\ge 50\%$.
                </p>
              </div>

              {certEligible.eligible ? (
                <Button onClick={handleGenerateCert} className="bg-violet-650 hover:bg-violet-755 text-white font-black text-xs px-6 h-10 rounded-xl shrink-0 flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Certificate PDF
                </Button>
              ) : (
                <Badge className="bg-rose-50 text-rose-800 border border-rose-200 font-black text-[10px]">
                  Not Eligible
                </Badge>
              )}
            </div>

            {!certEligible.eligible && certEligible.reasons && certEligible.reasons.length > 0 && (
              <div className="bg-white/80 border border-rose-100 rounded-xl p-3 text-[11px] space-y-1">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider block">Remaining Requirements:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-neutral-600 font-semibold">
                  {certEligible.reasons.map((r: string, index: number) => (
                    <li key={index}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}
      </div>
    )
  }

  // --- ONBOARDING FORM VIEW ---
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 space-y-8 animate-in fade-in duration-305">
      <div className="text-left space-y-2 border-b border-neutral-100 pb-5">
        <Badge className="bg-indigo-50 text-indigo-900 border-none uppercase text-[9px] font-black tracking-widest px-2.5 py-1">
          Sandbox Live Console
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 mt-2">
          Digital Marketing Sandbox Setup
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 font-semibold max-w-2xl mt-1">
          Configure campaign settings, match types, ad groups, or SEO content densities. Bypasses classroom limits and cohorts.
        </p>
      </div>

      {isIndividual ? (
        <div className="space-y-8 text-left">
          
          {/* STEP 1: SELECT SIMULATION TYPE */}
          <div className="space-y-3">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Step 1: Choose Live Simulation Mode</span>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { 
                  key: "GOOGLE_ADS", 
                  label: "Google Ads Simulation", 
                  desc: "Practice real Google Ads campaign setup, bidding, keyword targeting, ad copy, CPC, CTR, CPA, ROAS." 
                },
                { 
                  key: "META_ADS", 
                  label: "Meta Ads Simulation", 
                  desc: "Practice Meta/Facebook/Instagram ads setup, audience targeting, creatives, placements, CPM, CTR, conversions." 
                },
                { 
                  key: "SEO", 
                  label: "SEO Simulation", 
                  desc: "Practice keyword research, technical SEO, content optimization, backlink strategy, ranking, organic traffic." 
                }
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setSelectedMode(t.key as any)}
                  className={`p-5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                    selectedMode === t.key 
                      ? "border-indigo-650 bg-indigo-50/25 text-indigo-950 font-black shadow-md" 
                      : "border-neutral-200 hover:border-neutral-300 bg-white"
                  }`}
                >
                  <div>
                    <span className="text-xs font-black block">{t.label}</span>
                    <p className="text-[11px] text-neutral-400 leading-relaxed font-semibold mt-2.5">{t.desc}</p>
                  </div>
                  
                  {selectedMode === t.key && (
                    <div className="flex justify-end pt-4">
                      <Badge className="bg-indigo-650 text-white text-[9px] border-none font-bold uppercase py-0.5">Selected</Badge>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* STEP 2: CHOOSE SCENARIO */}
          <div className="space-y-4">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Step 2: Define Scenario Pathway</span>
            
            <div className="flex gap-2 bg-neutral-100 p-1.5 rounded-xl w-max">
              <button 
                onClick={() => setScenarioChoice("sample")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${scenarioChoice === 'sample' ? 'bg-white text-neutral-850 shadow-sm' : 'text-neutral-500'}`}
              >
                Use Pre-Seeded Sample Scenario
              </button>
              <button 
                onClick={() => setScenarioChoice("custom")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${scenarioChoice === 'custom' ? 'bg-white text-neutral-850 shadow-sm' : 'text-neutral-500'}`}
              >
                Create Custom Campaign Details
              </button>
            </div>

            {scenarioChoice === "sample" ? (
              <Card className="p-5 border border-neutral-200 bg-white space-y-3">
                <label htmlFor="preset-scenario-select" className="text-[10px] font-black text-neutral-500 block uppercase">Available Scenario Presets</label>
                {sampleScenariosError ? (
                  <div className="space-y-2 p-3.5 border border-rose-100 bg-rose-50/20 rounded-xl text-left">
                    <span className="text-xs text-rose-700 font-bold block">Failed to load preset scenarios.</span>
                    <Button 
                      onClick={() => {
                        setSampleScenariosError(false);
                        loadSampleScenarios(selectedMode);
                      }}
                      className="bg-neutral-900 hover:bg-neutral-950 text-white text-[10px] font-bold h-7 px-3 rounded-lg"
                    >
                      Retry Loading
                    </Button>
                  </div>
                ) : sampleScenarios.length > 0 ? (
                  <select 
                    id="preset-scenario-select"
                    name="presetScenarioId"
                    value={selectedScenarioId} 
                    onChange={(e) => setSelectedScenarioId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500"
                  >
                    {sampleScenarios.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.industry} - {s.difficulty} difficulty)</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-neutral-450 font-semibold block animate-pulse">Loading scenario list...</span>
                )}
              </Card>
            ) : (
              <Card className="p-6 border border-neutral-200 bg-white space-y-4">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-2 border-b border-neutral-50 pb-2">Custom Configuration Parameters</span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="custom-scenario-name" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Scenario Name</label>
                      <input 
                        id="custom-scenario-name"
                        name="scenarioName"
                        type="text" 
                        value={scenarioName} 
                        onChange={(e) => setScenarioName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold border border-neutral-200 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-industry" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Industry Sector</label>
                      <input 
                        id="custom-industry"
                        name="industry"
                        type="text" 
                        value={industry} 
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold border border-neutral-200 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-business-type" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Business Type</label>
                      <input 
                        id="custom-business-type"
                        name="businessType"
                        type="text" 
                        value={businessType} 
                        onChange={(e) => setBusinessType(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold border border-neutral-200 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label htmlFor="custom-target-audience" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Target Audience</label>
                      <input 
                        id="custom-target-audience"
                        name="targetAudience"
                        type="text" 
                        value={targetAudience} 
                        onChange={(e) => setTargetAudience(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold border border-neutral-200 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-target-location" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Target Location</label>
                      <input 
                        id="custom-target-location"
                        name="targetLocation"
                        type="text" 
                        value={targetLocation} 
                        onChange={(e) => setTargetLocation(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold border border-neutral-200 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-objective-kpi" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Objective / Target KPI</label>
                      <select 
                        id="custom-objective-kpi"
                        name="objectiveKPI"
                        value={objectiveKPI} 
                        onChange={(e) => setObjectiveKPI(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold border border-neutral-200 rounded-lg bg-white"
                      >
                        <option value="revenue">Revenue Scale</option>
                        <option value="conversions">Conversion Volume</option>
                        <option value="clicks">Traffic Clicks</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label htmlFor="custom-competition-level" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Competition / Difficulty</label>
                      <select 
                        id="custom-competition-level"
                        name="competitionLevel"
                        value={competitionLevel} 
                        onChange={(e) => setCompetitionLevel(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold border border-neutral-200 rounded-lg bg-white"
                      >
                        <option value="easy">Easy (Low CPC Rivalry)</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard (High CPM Bid Pressure)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="custom-product-description" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Product/Service Description</label>
                      <textarea 
                        id="custom-product-description"
                        name="productDescription"
                        value={productDescription} 
                        onChange={(e) => setProductDescription(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-1.5 text-xs font-semibold border border-neutral-200 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* STEP 3: SELECT TIMING / DURATION */}
          <div className="space-y-3">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Step 3: Duration & Bidding cycle timing</span>
            
            <Card className="p-6 border border-neutral-200 bg-white space-y-4">
              {isAdmin ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label htmlFor="admin-timing-mode" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Bidding Cycle Timing (Admin Control)</label>
                    <select 
                      id="admin-timing-mode"
                      name="timingMode"
                      value={timingMode} 
                      onChange={(e) => setTimingMode(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl bg-white"
                    >
                      <option value="instant">Instant Test Mode</option>
                      <option value="24h">24 Hours (Standard lockout)</option>
                      <option value="custom">Custom Hours</option>
                    </select>
                  </div>
                  
                  {timingMode === "custom" && (
                    <div>
                      <label htmlFor="admin-custom-hours" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Cycle Duration (Hours)</label>
                      <input 
                        id="admin-custom-hours"
                        name="customHours"
                        type="number" 
                        value={customHours} 
                        onChange={(e) => setCustomHours(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs font-semibold border border-neutral-200 rounded-lg focus:outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="admin-duration-days" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Campaign Duration (Total Rounds)</label>
                    <input 
                      id="admin-duration-days"
                      name="durationDays"
                      type="number" 
                      value={durationDays} 
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs font-semibold border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="learner-duration-days" className="text-[10px] font-black text-neutral-600 block uppercase mb-1">Package Subscription Cycle Duration</label>
                    <select 
                      id="learner-duration-days"
                      name="durationDays"
                      value={durationDays} 
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold border border-neutral-200 rounded-xl bg-white"
                    >
                      <option value={15}>15 Days Campaign (12h cycle locks)</option>
                      <option value={30}>30 Days Campaign (24h cycle locks)</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-neutral-400 block uppercase mb-1">Subscription Timing Lock</span>
                    <p className="text-xs text-neutral-500 font-semibold leading-relaxed mt-1">
                      Individual Learners run campaign rounds with standard locks to match pacing and realistic trend movements.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* ACTION SUBMIT */}
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleStartSimulation}
              disabled={isInitializingPath}
              className="bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs px-8 h-11 rounded-xl flex items-center gap-2 shadow-md"
            >
              Start Sandbox Simulation
              <ArrowRight className="h-4.5 w-4.5" />
            </Button>
          </div>

        </div>
      ) : (
        <Card className="max-w-md mx-auto p-6 bg-white border border-neutral-200 rounded-2xl shadow-sm text-center space-y-4">
          <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-black text-neutral-900">Sandbox Unplayable</h2>
          <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
            {errorMsg || "Only Individual Learners or administrators can access sandbox mode."}
          </p>
        </Card>
      )}

    </div>
  )
}
export default SimulationHomePage;
