import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useDailyCampaignStore } from "@/stores/dailyCampaignStore";
import { useAuthStore } from "@/stores/authStore";
import { normalizeRole } from "@/lib/normalizeRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { 
  Play, Activity,
  RefreshCw, ShieldAlert,
  Calendar, Flame, TrendingUp, DollarSign
} from "lucide-react";

export function CampaignDashboard() {
  const { user } = useAuthStore();
  const { activeRun, loading, results, fetchState, fetchResults, startCampaign, fastForward } = useDailyCampaignStore();
  const [fastForwarding, setFastForwarding] = useState(false);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (activeRun) {
      fetchResults(activeRun.id);
    }
  }, [activeRun, fetchResults]);

  const handleStartCampaign = async () => {
    await startCampaign();
  };

  const handleFastForward = async () => {
    setFastForwarding(true);
    await fastForward();
    setFastForwarding(false);
  };

  if (loading && !activeRun) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin" />
        <span className="text-sm text-neutral-500 font-bold">Booting campaign console...</span>
      </div>
    );
  }

  if (!activeRun) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-neutral-900 border border-neutral-800 rounded-3xl shadow-xl text-center space-y-6 text-white">
        <ShieldAlert className="h-14 w-14 text-rose-500 mx-auto animate-bounce" />
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">Daily Live Campaign Offline</h2>
          <p className="text-xs text-neutral-400 font-semibold leading-relaxed">
            No active 15-day or 30-day live campaign run has been initialized yet for your account.
          </p>
        </div>

        {normalizeRole(user?.role) === "STUDENT" && (
          <div className="text-xs bg-indigo-950 text-indigo-200 p-4 rounded-2xl border border-indigo-900 font-semibold leading-relaxed">
            Please make sure you have joined a class cohort with your instructor's invite code in the main dashboard.
          </div>
        )}

        {(normalizeRole(user?.role) !== null) && (
          <Button 
            onClick={handleStartCampaign}
            className="w-full bg-indigo-600 text-white hover:bg-indigo-700 font-black text-sm h-12 rounded-2xl shadow-lg transition-transform transform hover:-translate-y-0.5"
          >
            <Play className="mr-2 h-4 w-4 fill-white" />
            Launch Daily Live Simulation
          </Button>
        )}
      </div>
    );
  }

  const scenario = activeRun.scenario;
  const currentDay = activeRun.currentDay;
  const totalDays = activeRun.durationDays;
  const _progressPct = Math.round(((currentDay - 1) / totalDays) * 100); void _progressPct;

  // Calculate stats from results
  const yesterdayResult = results.find(r => r.dayNumber === currentDay - 1);
  const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0);
  const totalSpend = results.reduce((sum, r) => sum + r.spend, 0);
  const averageROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0.0;
  const currentScore = yesterdayResult?.compositeScore || 0.0;

  // Prepare chart data
  const chartData = results.map(r => ({
    name: `Day ${r.dayNumber}`,
    Revenue: r.revenue,
    Spend: r.spend,
    Score: r.compositeScore,
  }));

  const showDevControls = import.meta.env.MODE === "development" || import.meta.env.MODE === "test";

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-neutral-200 pb-6">
        <div>
          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full flex items-center gap-1.5 w-max">
            <Activity className="h-3.5 w-3.5" />
            Live daily Simulation Mode
          </span>
          <h1 className="text-3xl font-black text-neutral-900 mt-3 tracking-tight">
            Digital Marketing Campaign Panel
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 font-semibold mt-1">
            Running Scenario: <span className="text-neutral-800 font-bold">{scenario?.name || "B2B SaaS"}</span> • Duration: <span className="font-bold">{totalDays} Days</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {activeRun.status === "ACTIVE" ? (
            <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
              Campaign Active
            </Badge>
          ) : (
            <Badge className="bg-neutral-900 text-white font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
              Campaign Completed
            </Badge>
          )}

          {showDevControls && activeRun.status === "ACTIVE" && (
            <Button
              onClick={handleFastForward}
              disabled={fastForwarding}
              className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs h-9 rounded-full px-4"
            >
              {fastForwarding ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Flame className="mr-1.5 h-3.5 w-3.5" />
                  Dev: Fast-Forward Day
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Overview stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-neutral-200/80 shadow bg-white flex flex-col justify-between text-left">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Today's Step</span>
            <div className="text-2xl font-black text-neutral-900">Day {currentDay}</div>
          </div>
          <span className="text-[10px] text-neutral-400 font-bold mt-2 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-neutral-400" />
            Ends at {new Date(activeRun.endsAt).toLocaleDateString()}
          </span>
        </Card>

        <Card className="p-5 border-neutral-200/80 shadow bg-white flex flex-col justify-between text-left">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Yesterday Score</span>
            <div className="text-2xl font-black text-indigo-600">{currentScore.toFixed(1)}%</div>
          </div>
          <span className="text-[10px] text-neutral-400 font-bold mt-2 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
            Classroom average score evaluation
          </span>
        </Card>

        <Card className="p-5 border-neutral-200/80 shadow bg-white flex flex-col justify-between text-left">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Total Revenue</span>
            <div className="text-2xl font-black text-emerald-600">${totalRevenue.toLocaleString()}</div>
          </div>
          <span className="text-[10px] text-neutral-400 font-bold mt-2 flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
            Overall campaign yield
          </span>
        </Card>

        <Card className="p-5 border-neutral-200/80 shadow bg-white flex flex-col justify-between text-left">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Cumulative ROAS</span>
            <div className="text-2xl font-black text-neutral-800">{averageROAS.toFixed(2)}x</div>
          </div>
          <span className="text-[10px] text-neutral-400 font-bold mt-2 flex items-center gap-1">
            Total Spend: ${totalSpend.toLocaleString()}
          </span>
        </Card>
      </div>

      {/* Main Grid: charts + details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chart Column */}
        <Card className="lg:col-span-2 border-neutral-200/80 shadow-md p-6 bg-white space-y-6 text-left">
          <div>
            <h3 className="text-lg font-black text-neutral-900">Campaign Revenue & Spend Timeline</h3>
            <p className="text-xs text-neutral-500 font-semibold mt-0.5">Day-by-day financial progress</p>
          </div>

          <div className="h-72">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="Spend" stroke="#ef4444" fillOpacity={1} fill="url(#colorSpend)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-neutral-400 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 text-xs font-bold p-6">
                No simulated data results generated yet. Submit your Day 1 decisions to begin.
              </div>
            )}
          </div>
        </Card>

        {/* Sidebar details */}
        <div className="space-y-6">
          <Card className="border-neutral-200/80 shadow-md bg-white p-6 text-left space-y-6">
            <div>
              <h3 className="text-lg font-black text-neutral-900">Status Checklist</h3>
              <p className="text-xs text-neutral-500 font-semibold mt-0.5">Tasks due for today</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100">
                <div className="text-xs font-bold text-neutral-700">
                  Day {currentDay} Configuration
                </div>
                {activeRun.status === "ACTIVE" ? (
                  <Link to={`/campaign/day/${currentDay}`}>
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl h-8">
                      Edit Settings
                    </Button>
                  </Link>
                ) : (
                  <span className="text-xs text-neutral-500 font-black">Locked</span>
                )}
              </div>

              <div className="divide-y divide-neutral-100 text-xs font-semibold">
                <div className="py-3 flex justify-between">
                  <span className="text-neutral-500">Days Processed</span>
                  <span className="text-neutral-900 font-bold">{currentDay - 1} / {totalDays}</span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-neutral-500">Next Simulation Step</span>
                  <span className="text-indigo-600 font-bold">
                    {new Date(activeRun.nextProcessingAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="py-3 flex justify-between">
                  <span className="text-neutral-500">Classroom Standings</span>
                  <Link to="/leaderboard" className="text-neutral-800 font-bold underline hover:text-indigo-600">
                    View Leaderboard
                  </Link>
                </div>
              </div>

              <Link to="/campaign/timeline" className="block w-full">
                <Button variant="outline" className="w-full h-10 font-bold text-xs border-neutral-200 text-neutral-700 rounded-xl">
                  Open Campaign Timeline
                </Button>
              </Link>
            </div>
          </Card>

          {yesterdayResult && (
            <Card className="border-neutral-200/80 shadow-md bg-white p-6 text-left space-y-4">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Yesterday Metrics Summary</span>
              <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                <div className="bg-neutral-50 p-3 rounded-xl">
                  <span className="text-neutral-500 block text-[9px] uppercase">Conversions</span>
                  <span className="text-neutral-900 text-lg font-black">{yesterdayResult.conversions}</span>
                </div>
                <div className="bg-neutral-50 p-3 rounded-xl">
                  <span className="text-neutral-500 block text-[9px] uppercase">ROAS</span>
                  <span className="text-neutral-900 text-lg font-black">{yesterdayResult.roas.toFixed(2)}x</span>
                </div>
              </div>
              <Link to={`/campaign/results/day/${currentDay - 1}`} className="block text-center text-xs font-bold text-indigo-600 hover:underline">
                View Day {currentDay - 1} Full Report →
              </Link>
            </Card>
          )}
        </div>

      </div>

    </div>
  );
}
export default CampaignDashboard;
