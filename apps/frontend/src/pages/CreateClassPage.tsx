import { useState } from "react"
import { useNavigate } from "react-router"
import { useInstructorPortalStore } from "@/stores/instructorPortalStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Settings2,
  DollarSign,
  TrendingUp,
  Sliders,
  CheckCircle2
} from "lucide-react"

export function CreateClassPage() {
  const navigate = useNavigate()
  const { createClass, createCustomScenario } = useInstructorPortalStore()

  // Form State
  const [className, setClassName] = useState("")
  const [semester, setSemester] = useState("Spring 2026")
  const [batch, setBatch] = useState("Batch A")
  const [department, setDepartment] = useState("Business & Marketing")
  const [subject, setSubject] = useState("Digital Marketing Analytics")
  const [scenarioName, setScenarioName] = useState("")
  const [scenarioDescription, setScenarioDescription] = useState("")
  const [industry, setIndustry] = useState("Digital Marketing")
  const [maxRounds, setMaxRounds] = useState(10)
  const [budgetPerRound, setBudgetPerRound] = useState(5000)
  const [baselineOrganicTraffic, setBaselineOrganicTraffic] = useState(1000)
  const [targetKPI, setTargetKPI] = useState<"revenue" | "clicks" | "conversions">("revenue")
  const [difficulty, setDifficulty] = useState("medium")
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "GOOGLE_ADS"
  ])

  // Submission State
  const [isLoading, setIsLoading] = useState(false)

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms([platform])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Frontend Validations
    if (!className.trim()) {
      toast.error("Classroom Name is required.")
      return
    }
    if (!scenarioName.trim()) {
      toast.error("Scenario Name is required.")
      return
    }
    if (!scenarioDescription.trim()) {
      toast.error("Scenario Description is required.")
      return
    }
    if (maxRounds <= 0) {
      toast.error("Simulation Rounds must be positive.")
      return
    }
    if (budgetPerRound <= 0) {
      toast.error("Round budget must be positive.")
      return
    }
    if (baselineOrganicTraffic < 0) {
      toast.error("Baseline Organic Traffic cannot be negative.")
      return
    }

    setIsLoading(true)
    const toastId = toast.loading("Configuring custom scenario...")

    try {
      // Step 1: Create the Custom Scenario
      const scenarioData = {
        name: scenarioName.trim(),
        description: scenarioDescription.trim(),
        industry: industry.trim(),
        startRound: 1,
        maxRounds: Number(maxRounds),
        budgetPerRound: Number(budgetPerRound),
        baselineOrganicTraffic: Number(baselineOrganicTraffic),
        targetKPI,
        difficulty,
        allowedPlatforms: JSON.stringify(selectedPlatforms),
        simulationMode: selectedPlatforms[0]
      }

      const newScenario = await createCustomScenario(scenarioData)
      
      if (!newScenario || !newScenario.id) {
        throw new Error("Failed to retrieve custom scenario ID.")
      }

      toast.loading("Deploying new classroom...", { id: toastId })

      // Step 2: Create the Classroom using the returned scenarioId
      const newClass = await createClass(
        className.trim(),
        newScenario.id,
        semester.trim(),
        batch.trim(),
        department.trim(),
        subject.trim(),
        "SimLab Marketing Academy"
      )

      toast.success(`Classroom "${newClass.class.name}" successfully created!`, { id: toastId })
      
      // Redirect back to Instructor Portal
      navigate("/instructor")
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || err.message || "Failed to create class or scenario.", { id: toastId })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Back to Portal Header */}
      <div className="flex justify-between items-center">
        <Button
          onClick={() => navigate("/instructor")}
          variant="ghost"
          className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-1.5 h-8 p-2"
          disabled={isLoading}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Instructor Portal
        </Button>
        <span className="text-xs text-neutral-400 font-semibold">
          Step 1 of 1: Setup Classroom & Scenario
        </span>
      </div>

      {/* Banner Title */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-gradient-to-r from-neutral-900 via-indigo-950 to-neutral-950 p-6 md:p-8 text-white shadow-lg text-left">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative z-10 space-y-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
            <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-300">Custom Campaign Architect</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Create Custom Class Cohort
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl font-medium leading-relaxed">
            Construct a professional environment for your students. Instead of relying on randomized campaign conditions, design a custom digital marketing scenario from scratch with specific objectives, budget envelopes, and constraints.
          </p>
        </div>
      </div>

      {/* Creation Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Section: Cohort Metadata & General Setup */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border border-neutral-200/80 shadow-sm bg-white text-left">
            <CardHeader className="border-b border-neutral-100 p-5">
              <CardTitle className="text-sm font-black text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="h-4.5 w-4.5 text-indigo-600" />
                Classroom Details
              </CardTitle>
              <CardDescription className="text-[11px] font-semibold text-neutral-400">
                Identify this student cohort in your management logs.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              {/* Class Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="classNameInput">
                  Classroom Name
                </label>
                <Input
                  id="classNameInput"
                  type="text"
                  placeholder="e.g. Marketing Principles Cohort B"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="text-xs border-neutral-200 h-10 font-semibold text-neutral-808 bg-white focus-visible:ring-indigo-500"
                  disabled={isLoading}
                  required
                />
                <span className="text-[10px] text-neutral-400 block leading-tight">
                  Students will see this name when joining the class cohort.
                </span>
              </div>

              {/* Semester */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="semesterInput">
                  Semester
                </label>
                <Input
                  id="semesterInput"
                  type="text"
                  placeholder="e.g. Spring 2026"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="text-xs border-neutral-200 h-10 font-semibold text-neutral-808 bg-white focus-visible:ring-indigo-500"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Batch */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="batchInput">
                  Batch
                </label>
                <Input
                  id="batchInput"
                  type="text"
                  placeholder="e.g. Batch A"
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="text-xs border-neutral-200 h-10 font-semibold text-neutral-808 bg-white focus-visible:ring-indigo-500"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="departmentInput">
                  Department
                </label>
                <Input
                  id="departmentInput"
                  type="text"
                  placeholder="e.g. Business & Marketing"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="text-xs border-neutral-200 h-10 font-semibold text-neutral-808 bg-white focus-visible:ring-indigo-500"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="subjectInput">
                  Subject
                </label>
                <Input
                  id="subjectInput"
                  type="text"
                  placeholder="e.g. Digital Marketing Analytics"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="text-xs border-neutral-200 h-10 font-semibold text-neutral-808 bg-white focus-visible:ring-indigo-500"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Industry */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="industryInput">
                  Target Industry Vertical
                </label>
                <Input
                  id="industryInput"
                  type="text"
                  placeholder="e.g. Apparel E-Commerce, B2B SaaS"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="text-xs border-neutral-200 h-10 font-semibold text-neutral-808 bg-white focus-visible:ring-indigo-500"
                  disabled={isLoading}
                  required
                />
                <span className="text-[10px] text-neutral-400 block leading-tight">
                  The primary sector context for the marketing campaign.
                </span>
              </div>

            </CardContent>
          </Card>

          {/* Form Actions Card */}
          <Card className="border border-neutral-200/80 shadow-sm bg-neutral-50/50 p-5 text-left space-y-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Live Validation Checks
              </h4>
              <p className="text-[10px] text-neutral-400 font-semibold">
                Your custom scenario is built with dynamic verification to ensure it runs correctly on the sandbox engines.
              </p>
            </div>
            
            <div className="flex flex-col gap-2 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 hover:bg-slate-950 text-white text-xs font-black h-11 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isLoading ? "Configuring & Deploying..." : "Launch Class Cohort"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/instructor")}
                disabled={isLoading}
                className="w-full border-neutral-250 text-neutral-600 hover:bg-neutral-100 text-xs font-bold h-10 rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Section: Custom Scenario Engine Setup */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border border-neutral-200/80 shadow-sm bg-white text-left">
            <CardHeader className="border-b border-neutral-100 p-5">
              <CardTitle className="text-sm font-black text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="h-4.5 w-4.5 text-indigo-600" />
                Custom Scenario Configurator
              </CardTitle>
              <CardDescription className="text-[11px] font-semibold text-neutral-400">
                Setup the budget, objectives, rounds, and complexity parameters for the students' campaigns.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              
              {/* Grid for Scenario Name & Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Scenario Name */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="scenarioNameInput">
                    Scenario Title
                  </label>
                  <Input
                    id="scenarioNameInput"
                    type="text"
                    placeholder="e.g. EcoFashion Blitz, SaaS Growth Hack"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    className="text-xs border-neutral-200 h-10 font-semibold text-neutral-808 bg-white focus-visible:ring-indigo-500"
                    disabled={isLoading}
                    required
                  />
                </div>

                {/* Difficulty */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="difficultyInput">
                    Difficulty Level
                  </label>
                  <select
                    id="difficultyInput"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-xs bg-white font-semibold text-neutral-808 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    disabled={isLoading}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="medium">Intermediate (Medium)</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

              </div>

              {/* Scenario Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="scenarioDescInput">
                  Scenario Campaign Description
                </label>
                <Textarea
                  id="scenarioDescInput"
                  placeholder="Describe the company's background, product, target demographics, and general campaign goals for the student..."
                  value={scenarioDescription}
                  onChange={(e) => setScenarioDescription(e.target.value)}
                  className="text-xs border-neutral-200 min-h-[90px] font-semibold text-neutral-808 bg-white focus-visible:ring-indigo-500"
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Enabled Platforms / Simulation Type */}
              <div className="space-y-2 border-t border-neutral-100 pt-4">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">
                  Class Simulation Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "GOOGLE_ADS", label: "Google Ads Only", desc: "Paid search campaigns, keyword bids, and search engine budget optimization" },
                    { id: "META_ADS", label: "Meta Ads Only", desc: "Paid social campaigns, audiences, bidding types, and creative assets" },
                    { id: "SEO", label: "SEO Only", desc: "Organic search optimization, content quality, backlink build, and metadata" }
                  ].map((p) => {
                    const isChecked = selectedPlatforms.includes(p.id)
                    return (
                      <div
                        key={p.id}
                        onClick={() => handlePlatformToggle(p.id)}
                        className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? "border-indigo-650 bg-indigo-50/20 text-indigo-950"
                            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="simulationType"
                            checked={isChecked}
                            onChange={() => {}} // toggled by parent div click
                            className="rounded-full border-neutral-350 text-indigo-650 focus:ring-indigo-500 h-3.5 w-3.5 pointer-events-none"
                          />
                          <span className="text-xs font-bold">{p.label}</span>
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-1 leading-tight font-medium">
                          {p.desc}
                        </p>
                      </div>
                    )
                  })}
                </div>
                <span className="text-[10px] text-neutral-400 block leading-tight">
                  Choose the single marketing module active for this classroom simulation. Only one mode is permitted per class.
                </span>
              </div>

              {/* Grid for budget, rounds, organic traffic, and KPI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-neutral-100">
                
                {/* Rounds Slider / Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider flex items-center gap-1" htmlFor="maxRoundsInput">
                      <Sliders className="h-3 w-3 text-neutral-450" />
                      Simulation Rounds
                    </label>
                    <Badge variant="outline" className="text-[10px] font-bold border-indigo-200 text-indigo-700 bg-indigo-50/20">
                      {maxRounds} Rounds
                    </Badge>
                  </div>
                  <Input
                    id="maxRoundsInput"
                    type="number"
                    min="1"
                    max="30"
                    value={maxRounds}
                    onChange={(e) => setMaxRounds(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-xs border-neutral-200 h-10 font-semibold text-neutral-808 focus-visible:ring-indigo-500"
                    disabled={isLoading}
                    required
                  />
                  <span className="text-[10px] text-neutral-400 block leading-tight">
                    Total decision cycles. Students submit inputs and receive engine outcomes once per round.
                  </span>
                </div>

                {/* Round Budget */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider flex items-center gap-1" htmlFor="roundBudgetInput">
                      <DollarSign className="h-3 w-3 text-neutral-450" />
                      Budget Per Round
                    </label>
                    <Badge variant="outline" className="text-[10px] font-bold border-emerald-250 text-emerald-700 bg-emerald-50/20">
                      ${budgetPerRound.toLocaleString()} / Round
                    </Badge>
                  </div>
                  <Input
                    id="roundBudgetInput"
                    type="number"
                    min="100"
                    step="50"
                    value={budgetPerRound}
                    onChange={(e) => setBudgetPerRound(Math.max(1, parseInt(e.target.value) || 0))}
                    className="text-xs border-neutral-200 h-10 font-semibold text-neutral-808 focus-visible:ring-indigo-500"
                    disabled={isLoading}
                    required
                  />
                  <span className="text-[10px] text-neutral-400 block leading-tight">
                    Maximum currency allocation per round. Divided among SEO, Google Ads, and Meta Ads.
                  </span>
                </div>

                {/* Baseline Organic Traffic */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider flex items-center gap-1" htmlFor="baselineTrafficInput">
                      <TrendingUp className="h-3 w-3 text-neutral-450" />
                      Baseline Organic Traffic
                    </label>
                    <Badge variant="outline" className="text-[10px] font-bold border-amber-200 text-amber-700 bg-amber-50/20">
                      {baselineOrganicTraffic.toLocaleString()} Visits / Mo
                    </Badge>
                  </div>
                  <Input
                    id="baselineTrafficInput"
                    type="number"
                    min="0"
                    step="100"
                    value={baselineOrganicTraffic}
                    onChange={(e) => setBaselineOrganicTraffic(Math.max(0, parseInt(e.target.value) || 0))}
                    className="text-xs border-neutral-200 h-10 font-semibold text-neutral-808 focus-visible:ring-indigo-500"
                    disabled={isLoading}
                    required
                  />
                  <span className="text-[10px] text-neutral-400 block leading-tight">
                    Starting organic search traffic baseline before applying any SEO or keyword adjustments.
                  </span>
                </div>

                {/* Target KPI Objective */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="targetKpiInput">
                    Primary Target KPI Objective
                  </label>
                  <select
                    id="targetKpiInput"
                    value={targetKPI}
                    onChange={(e) => setTargetKPI(e.target.value as "revenue" | "clicks" | "conversions")}
                    className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-xs bg-white font-semibold text-neutral-808 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    disabled={isLoading}
                  >
                    <option value="revenue">Revenue Generation (Total Sales Dollar Amount)</option>
                    <option value="clicks">Click-Through Engagement (Ad Clicks)</option>
                    <option value="conversions">Lead / Order Conversions (Total Count)</option>
                  </select>
                  <span className="text-[10px] text-neutral-400 block leading-tight">
                    The primary conversion objective tracked and scored on the student dashboard.
                  </span>
                </div>

              </div>

            </CardContent>
          </Card>
        </div>

      </form>

    </div>
  )
}

export default CreateClassPage
