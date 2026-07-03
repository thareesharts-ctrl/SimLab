import { useState, useEffect } from "react"
import { useInstructorPortalStore } from "@/stores/instructorPortalStore"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Sparkles, Plus, BookOpen, Clock, Activity, Target } from "lucide-react"
import api from "@/lib/api"

export function InstructorScenariosPage() {
  const { scenarios, fetchScenarios, createCustomScenario } = useInstructorPortalStore()
  const [showBuilder, setShowBuilder] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form States
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [industry, setIndustry] = useState("CRM SaaS")
  const [difficulty, setDifficulty] = useState("medium")
  const [maxRounds, setMaxRounds] = useState(10)
  const [budgetPerRound, setBudgetPerRound] = useState(5000)
  const [targetKPI, setTargetKPI] = useState<"revenue" | "clicks" | "conversions">("revenue")
  const [checkpointRequired, setCheckpointRequired] = useState(true)
  const [allowedPlatforms, setAllowedPlatforms] = useState<string[]>(["SEO", "GOOGLE_ADS", "META_ADS"])

  useEffect(() => {
    fetchScenarios()
  }, [fetchScenarios])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Scenario name is required.")
      return
    }
    setLoading(true)
    try {
      await createCustomScenario({
        name: name.trim(),
        description: description.trim() || `Custom learning scenario for ${industry}`,
        industry,
        difficulty,
        maxRounds,
        budgetPerRound,
        targetKPI,
        allowedPlatforms: JSON.stringify(allowedPlatforms)
      })
      toast.success("Custom scenario created successfully!")
      setShowBuilder(false)
      // Reset form
      setName("")
      setDescription("")
      setMaxRounds(10)
      setBudgetPerRound(5000)
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create custom scenario.")
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePlatform = (platform: string) => {
    setAllowedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
        <div>
          <Badge className="bg-indigo-50 text-indigo-900 border-none uppercase text-[9px] font-black tracking-widest px-2.5 py-1 mb-2">
            Scenario Manager
          </Badge>
          <h1 className="text-2xl md:text-3xl font-black text-neutral-900">
            Scenario Library &amp; Builder
          </h1>
          <p className="text-xs md:text-sm text-neutral-500 font-semibold">
            Create tailored digital advertising campaigns and organic SEO challenges for your student cohorts.
          </p>
        </div>
        <Button
          onClick={() => setShowBuilder(!showBuilder)}
          className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold px-4 h-10 rounded-xl flex items-center gap-1.5 shrink-0 self-start md:self-center"
        >
          <Plus className="h-4 w-4" />
          {showBuilder ? "View Library" : "Build Custom Scenario"}
        </Button>
      </div>

      {showBuilder ? (
        <Card className="border border-neutral-250/60 shadow-sm rounded-2xl bg-white animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CardHeader>
            <CardTitle className="text-lg font-black text-neutral-900">Configure Custom Scenario</CardTitle>
            <CardDescription className="text-xs font-semibold text-neutral-500">
              Define the duration, budgets, allowed advertising platforms, and performance target goals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2 text-left">
                  <label htmlFor="scenario-name" className="text-xs font-bold text-neutral-700">Scenario Name</label>
                  <Input
                    id="scenario-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Enterprise SaaS Scale-Up"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>
                <div className="space-y-2 text-left">
                  <label htmlFor="scenario-industry" className="text-xs font-bold text-neutral-700">Industry Sector</label>
                  <Input
                    id="scenario-industry"
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    placeholder="e.g. Fintech, Healthcare, Fashion"
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 text-left">
                <label htmlFor="scenario-desc" className="text-xs font-bold text-neutral-700">Briefing &amp; Objectives Description</label>
                <textarea
                  id="scenario-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Provide context and background details for students..."
                  className="w-full min-h-[100px] p-3 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-2 text-left">
                  <label htmlFor="scenario-rounds" className="text-xs font-bold text-neutral-700">Simulation Rounds</label>
                  <Input
                    id="scenario-rounds"
                    type="number"
                    value={maxRounds}
                    onChange={e => setMaxRounds(parseInt(e.target.value) || 10)}
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>
                <div className="space-y-2 text-left">
                  <label htmlFor="scenario-budget" className="text-xs font-bold text-neutral-700">Budget Per Round ($)</label>
                  <Input
                    id="scenario-budget"
                    type="number"
                    value={budgetPerRound}
                    onChange={e => setBudgetPerRound(parseInt(e.target.value) || 5000)}
                    className="h-10 rounded-xl text-xs"
                    required
                  />
                </div>
                <div className="space-y-2 text-left">
                  <label htmlFor="scenario-difficulty" className="text-xs font-bold text-neutral-700">Difficulty Rating</label>
                  <select
                    id="scenario-difficulty"
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value)}
                    className="w-full h-10 px-3 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="easy">Easy / Beginner</option>
                    <option value="medium">Medium / Intermediate</option>
                    <option value="hard">Hard / Advanced</option>
                  </select>
                </div>
                <div className="space-y-2 text-left">
                  <label htmlFor="scenario-kpi" className="text-xs font-bold text-neutral-700">Target KPI Objective</label>
                  <select
                    id="scenario-kpi"
                    value={targetKPI}
                    onChange={e => setTargetKPI(e.target.value as any)}
                    className="w-full h-10 px-3 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="revenue">Maximize Revenue</option>
                    <option value="clicks">Maximize Traffic / Clicks</option>
                    <option value="conversions">Maximize Conversions</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 text-left">
                <span className="text-xs font-bold text-neutral-700 block">Allowed Advertising Channels</span>
                <div className="flex gap-4">
                  {["SEO", "GOOGLE_ADS", "META_ADS"].map(platform => (
                    <label key={platform} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-600">
                      <input
                        type="checkbox"
                        checked={allowedPlatforms.includes(platform)}
                        onChange={() => handleTogglePlatform(platform)}
                        className="rounded border-neutral-300 text-indigo-650 focus:ring-indigo-500"
                      />
                      {platform.replace("_", " ")}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBuilder(false)}
                  className="rounded-xl px-4 text-xs font-bold h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl px-4 text-xs h-9"
                >
                  {loading ? "Creating..." : "Save Scenario"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {scenarios.length === 0 ? (
            <div className="col-span-full py-12 text-center text-neutral-500 font-semibold">
              No scenarios found. Click &quot;Build Custom Scenario&quot; to define a new learning task.
            </div>
          ) : (
            scenarios.map(scen => (
              <Card key={scen.id} className="border border-neutral-200/80 shadow-sm rounded-2xl bg-white hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                <div className="p-5 space-y-3 text-left">
                  <div className="flex justify-between items-start gap-2">
                    <Badge className="bg-indigo-50 text-indigo-900 border-none uppercase text-[8px] font-black tracking-widest px-2 py-0.5">
                      {scen.difficulty}
                    </Badge>
                  </div>
                  <h3 className="font-black text-neutral-900 text-sm truncate">{scen.name}</h3>
                  <p className="text-xs text-neutral-500 font-medium line-clamp-3 leading-relaxed">
                    {scen.description}
                  </p>
                </div>
                <div className="bg-neutral-50 px-5 py-3 border-t border-neutral-150/40 flex items-center justify-between text-[11px] text-neutral-500 font-bold">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {scen.rounds} Rounds</span>
                  <span className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> ${scen.budget} Budget</span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
export default InstructorScenariosPage
