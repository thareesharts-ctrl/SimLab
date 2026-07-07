import React, { useEffect, useState } from "react";
import { useBillingStore } from "@/stores/billingStore";
import { useAuthStore } from "@/stores/authStore";
import { normalizeRole } from "@/lib/normalizeRole";
import { exportToCSV, generatePDF } from "@/lib/exportUtils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Activity,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  Tag,
  Plus,
  Search,
  FileText,
  Download
} from "lucide-react";

const CHART_COLORS = ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"];

export function AdminBillingCenter() {
  const [activeTab, setActiveTab] = useState<"analytics" | "plans" | "reports">("analytics");
  const {
    adminStats,
    planDistribution,
    revenueTrends,
    coupons,
    plans,
    subscriptions,
    fetchAdminBillingData,
    fetchCoupons,
    createCoupon,
    fetchPlans,
    createPlan,
    updatePlan,
    fetchSubscriptions
  } = useBillingStore();
  const { user } = useAuthStore();

  // New coupon form states
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat" | "trial_extension">("percentage");
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [maxRedemptions, setMaxRedemptions] = useState<string>("");
  const [creating, setCreating] = useState(false);

  // New plan management states
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    code: "",
    priceMonthly: 0,
    priceYearly: 0,
    simulationLimit: -1,
    studentLimit: -1,
    instructorLimit: -1,
    certificateLimit: -1,
    reportExportLimit: -1,
    storageLimitMb: 50,
    featuresString: "",
    durationDays: 30,
    isActive: true
  });

  // Subscription reports states
  const [subStatusFilter, setSubStatusFilter] = useState<string>("all");
  const [subSearchQuery, setSubSearchQuery] = useState<string>("");
  const [loadingSubscriptions, setLoadingSubscriptions] = useState<boolean>(false);

  useEffect(() => {
    if (normalizeRole(user?.role) === "SUPER_ADMIN") {
      fetchAdminBillingData();
      fetchCoupons();
      fetchPlans();
    }
  }, [fetchAdminBillingData, fetchCoupons, fetchPlans, user]);

  useEffect(() => {
    if (normalizeRole(user?.role) === "SUPER_ADMIN" && activeTab === "reports") {
      const load = async () => {
        setLoadingSubscriptions(true);
        try {
          await fetchSubscriptions(subStatusFilter, subSearchQuery);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingSubscriptions(false);
        }
      };
      load();
    }
  }, [activeTab, subStatusFilter, subSearchQuery, fetchSubscriptions, user]);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setCreating(true);
    try {
      await createCoupon({
        code: code.trim().toUpperCase(),
        discountType,
        discountValue,
        maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : null
      });
      alert("Promo coupon created successfully!");
      // Reset form
      setCode("");
      setMaxRedemptions("");
    } catch (err: any) {
      alert(`Coupon creation failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleEditStart = (plan: any) => {
    setEditingPlanId(plan.id);
    let parsedFeatures: string[] = [];
    try {
      parsedFeatures = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features;
    } catch {
      parsedFeatures = [];
    }
    setPlanForm({
      name: plan.name,
      code: plan.code,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      simulationLimit: plan.simulationLimit,
      studentLimit: plan.studentLimit,
      instructorLimit: plan.instructorLimit,
      certificateLimit: plan.certificateLimit,
      reportExportLimit: plan.reportExportLimit,
      storageLimitMb: plan.storageLimitMb,
      featuresString: parsedFeatures.join(", "),
      durationDays: plan.durationDays ?? 30,
      isActive: plan.isActive ?? true
    });
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const features = planForm.featuresString
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
      const payload = {
        name: planForm.name,
        priceMonthly: planForm.priceMonthly,
        priceYearly: planForm.priceYearly,
        simulationLimit: planForm.simulationLimit,
        studentLimit: planForm.studentLimit,
        instructorLimit: planForm.instructorLimit,
        certificateLimit: planForm.certificateLimit,
        reportExportLimit: planForm.reportExportLimit,
        storageLimitMb: planForm.storageLimitMb,
        features,
        durationDays: planForm.durationDays,
        isActive: planForm.isActive
      };
      if (editingPlanId) {
        await updatePlan(editingPlanId, payload);
        alert("Plan updated successfully!");
        setEditingPlanId(null);
      } else {
        await createPlan({
          ...payload,
          code: planForm.code
        });
        alert("Plan created successfully!");
      }
      setPlanForm({
        name: "",
        code: "",
        priceMonthly: 0,
        priceYearly: 0,
        simulationLimit: -1,
        studentLimit: -1,
        instructorLimit: -1,
        certificateLimit: -1,
        reportExportLimit: -1,
        storageLimitMb: 50,
        featuresString: "",
        durationDays: 30,
        isActive: true
      });
    } catch (err: any) {
      alert(`Plan action failed: ${err.message}`);
    }
  };

  if (normalizeRole(user?.role) !== "SUPER_ADMIN") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        You do not have permission to access the Administrative Billing Dashboard.
      </div>
    );
  }

  // Format currency
  const formatCurrency = (val: number) => `₹${val.toLocaleString()}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      {/* Background glowing effects */}
      <div className="absolute top-0 right-10 w-[500px] h-[300px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-10 border-b border-slate-900 pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-indigo-400" /> Admin Financial Command Center
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Super Admin SaaS billing statistics, revenue analytics, MRR/ARR targets, and promo coupon controls.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-900 mb-8">
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
              activeTab === "analytics"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Revenue Analytics & Coupons
          </button>
          <button
            onClick={() => setActiveTab("plans")}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
              activeTab === "plans"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Manage Pricing Plans
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
              activeTab === "reports"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Subscription Reports
          </button>
        </div>

        {activeTab === "analytics" && (
          <>
            {/* 8 visual KPIs cards */}
        {adminStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            {/* MRR */}
            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800/80 shadow-lg">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase tracking-wider">Monthly Rec. Revenue</span>
                <DollarSign className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xl font-black text-white mt-2">{formatCurrency(adminStats.mrr)}</p>
              <div className="text-[10px] text-emerald-400 mt-1">▲ Steady growth</div>
            </div>

            {/* ARR */}
            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800/80 shadow-lg">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase tracking-wider">Annual Rec. Revenue</span>
                <DollarSign className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xl font-black text-white mt-2">{formatCurrency(adminStats.arr)}</p>
              <div className="text-[10px] text-emerald-400 mt-1">▲ Projected yearly target</div>
            </div>

            {/* Revenue */}
            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800/80 shadow-lg">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase tracking-wider">Gross Cumulative Revenue</span>
                <DollarSign className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xl font-black text-white mt-2">{formatCurrency(adminStats.revenue)}</p>
              <div className="text-[10px] text-emerald-400 mt-1">Captured payments logs</div>
            </div>

            {/* Churn Rate */}
            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800/80 shadow-lg">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase tracking-wider">SaaS Churn Rate</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-xl font-black text-white mt-2">{adminStats.churnRate}%</p>
              <div className="text-[10px] text-slate-400 mt-1">Cancelled vs Active accounts</div>
            </div>

            {/* Active Subscriptions */}
            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800/80 shadow-lg">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase tracking-wider">Active Paid Subs</span>
                <UserCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-black text-white mt-2">{adminStats.activeSubscriptions}</p>
              <div className="text-[10px] text-indigo-400 mt-1">Premium users license</div>
            </div>

            {/* Trial Conversions */}
            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800/80 shadow-lg">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase tracking-wider">Trial Conversion</span>
                <Activity className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xl font-black text-white mt-2">{adminStats.trialConversions}%</p>
              <div className="text-[10px] text-indigo-400 mt-1">Trial to Paid transition</div>
            </div>

            {/* Failed Payments */}
            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800/80 shadow-lg">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase tracking-wider">Failed Transactions</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-xl font-black text-white mt-2">{adminStats.failedPayments}</p>
              <div className="text-[10px] text-red-400 mt-1">Gateway card declines</div>
            </div>

            {/* Refund Stats */}
            <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800/80 shadow-lg">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs uppercase tracking-wider">Refunded Capital</span>
                <RotateCcw className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xl font-black text-white mt-2">{formatCurrency(adminStats.refundStatistics)}</p>
              <div className="text-[10px] text-slate-400 mt-1">Returned payments total</div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Revenue Trends Chart (Col span 2) */}
          <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6">Revenue Growth Trends (Last 6 Months)</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `₹${val}`} />
                  <ChartTooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px" }}
                    labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    name="Revenue Collected"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Plan Distribution (Col span 1) */}
          <div className="lg:col-span-1 bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl flex flex-col justify-between">
            <h3 className="text-lg font-bold text-white mb-6">Active Plan Distribution</h3>
            <div className="h-56 w-full flex justify-center items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={planDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {planDistribution.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Chart Legend */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {planDistribution.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-slate-300">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                  <span className="truncate">{entry.name}: {entry.value}</span>
                </div>
              ))}
              {planDistribution.length === 0 && (
                <div className="col-span-2 text-center text-slate-500 py-2">
                  No active subscribers to distribute.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coupons System Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Promo Coupon Form (Col span 1) */}
          <div className="lg:col-span-1 bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" /> Provision Coupon Code
            </h3>
            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Coupon Promo Code</label>
                <input
                  type="text"
                  placeholder="e.g. SUMMER50"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Discount Metric Type</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                >
                  <option value="percentage">Percentage Discount (%)</option>
                  <option value="flat">Flat Price Reduction (₹)</option>
                  <option value="trial_extension">Trial Extension (Days)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Discount Value ({discountType === "percentage" ? "%" : discountType === "flat" ? "₹" : "Days"})
                </label>
                <input
                  type="number"
                  min={1}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Math.max(1, parseInt(e.target.value) || 0))}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Redemptions Cap (Optional)</label>
                <input
                  type="number"
                  placeholder="Unlimited if empty"
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold tracking-wide transition shadow-lg shadow-indigo-500/10 mt-4 flex items-center justify-center gap-1"
              >
                <Tag className="w-4 h-4" /> {creating ? "Creating..." : "Provision Coupon"}
              </button>
            </form>
          </div>

          {/* List of Coupons (Col span 2) */}
          <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">Redemption Coupons Registry</h3>
            <div className="overflow-x-auto max-h-[350px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider sticky top-0 bg-slate-900 z-10 pb-2">
                    <th className="pb-3">Promo Code</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Discount Value</th>
                    <th className="pb-3">Redemptions</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-slate-800/20">
                      <td className="py-3 font-mono font-bold text-slate-200">{coupon.code}</td>
                      <td className="py-3 capitalize">{coupon.discountType.replace("_", " ")}</td>
                      <td className="py-3">
                        {coupon.discountType === "percentage"
                          ? `${coupon.discountValue}%`
                          : coupon.discountType === "flat"
                          ? `₹${coupon.discountValue}`
                          : `${coupon.discountValue} Days`}
                      </td>
                      <td className="py-3">
                        {coupon.redemptionsCount} / {coupon.maxRedemptions || "∞"}
                      </td>
                      <td className="py-3">
                        {coupon.isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/10">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-950 text-slate-500 border border-slate-800">
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {coupons.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        No coupon codes provisioned yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
          </div>
        </div>
      </div>
    </>
  )}

        {activeTab === "plans" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create/Edit Pricing Plan Form */}
        <div className="lg:col-span-1 bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-400" />
            {editingPlanId ? "Update Pricing Plan" : "Provision Pricing Plan"}
          </h3>
          <form onSubmit={handleSavePlan} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Plan Name</label>
              <input
                type="text"
                placeholder="e.g. Enterprise Plus"
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Plan Code (Unique ID)</label>
              <input
                type="text"
                placeholder="e.g. enterprise_plus"
                value={planForm.code}
                onChange={(e) => setPlanForm({ ...planForm, code: e.target.value.toLowerCase() })}
                required
                disabled={!!editingPlanId}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Price Monthly (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={planForm.priceMonthly}
                  onChange={(e) => setPlanForm({ ...planForm, priceMonthly: parseFloat(e.target.value) || 0 })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Price Yearly (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={planForm.priceYearly}
                  onChange={(e) => setPlanForm({ ...planForm, priceYearly: parseFloat(e.target.value) || 0 })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Simulation Limit (-1 = ∞)</label>
                <input
                  type="number"
                  value={planForm.simulationLimit}
                  onChange={(e) => setPlanForm({ ...planForm, simulationLimit: parseInt(e.target.value) || 0 })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Student Limit (-1 = ∞)</label>
                <input
                  type="number"
                  value={planForm.studentLimit}
                  onChange={(e) => setPlanForm({ ...planForm, studentLimit: parseInt(e.target.value) || 0 })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Instructor Limit (-1 = ∞)</label>
                <input
                  type="number"
                  value={planForm.instructorLimit}
                  onChange={(e) => setPlanForm({ ...planForm, instructorLimit: parseInt(e.target.value) || 0 })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Certificate Limit (-1 = ∞)</label>
                <input
                  type="number"
                  value={planForm.certificateLimit}
                  onChange={(e) => setPlanForm({ ...planForm, certificateLimit: parseInt(e.target.value) || 0 })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Export Limit (-1 = ∞)</label>
                <input
                  type="number"
                  value={planForm.reportExportLimit}
                  onChange={(e) => setPlanForm({ ...planForm, reportExportLimit: parseInt(e.target.value) || 0 })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Storage Limit (MB)</label>
                <input
                  type="number"
                  value={planForm.storageLimitMb}
                  onChange={(e) => setPlanForm({ ...planForm, storageLimitMb: parseInt(e.target.value) || 0 })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Features (Comma-separated)</label>
              <textarea
                placeholder="e.g. SEO Simulation, Google Ads, Meta Ads, PDF Export, Live Support"
                value={planForm.featuresString}
                onChange={(e) => setPlanForm({ ...planForm, featuresString: e.target.value })}
                className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Duration (Days)</label>
                <input
                  type="number"
                  min={1}
                  value={planForm.durationDays}
                  onChange={(e) => setPlanForm({ ...planForm, durationDays: parseInt(e.target.value) || 30 })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500/30"
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="isActivePlan"
                  checked={planForm.isActive}
                  onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                  className="w-4 h-4 bg-slate-950 border border-slate-800 rounded outline-none accent-indigo-500 cursor-pointer"
                />
                <label htmlFor="isActivePlan" className="text-xs text-slate-400 cursor-pointer select-none font-semibold">
                  Is Active Plan
                </label>
              </div>
            </div>

            <div className="flex gap-4 mt-4">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold tracking-wide transition shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-1"
              >
                <Tag className="w-4 h-4" /> {editingPlanId ? "Update Plan" : "Provision Plan"}
              </button>
              {editingPlanId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlanId(null);
                    setPlanForm({
                      name: "",
                      code: "",
                      priceMonthly: 0,
                      priceYearly: 0,
                      simulationLimit: -1,
                      studentLimit: -1,
                      instructorLimit: -1,
                      certificateLimit: -1,
                      reportExportLimit: -1,
                      storageLimitMb: 50,
                      featuresString: "",
                      durationDays: 30,
                      isActive: true
                    });
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Pricing Plans Registry */}
        <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-4">Pricing Plans Registry</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto pr-2">
            {plans.map((plan) => {
              let featureList: string[] = [];
              try {
                featureList = typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features;
              } catch {
                featureList = [];
              }
              return (
                <div
                  key={plan.id}
                  className="bg-slate-950/60 p-5 rounded-2xl border border-slate-850 hover:border-indigo-500/30 transition shadow-lg relative flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-base font-extrabold text-white flex items-center gap-1.5">
                        {plan.name}
                        {plan.isActive ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-rose-500" title="Inactive" />
                        )}
                      </h4>
                      <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/20 text-[10px] font-mono text-indigo-400 font-bold uppercase">
                        {plan.code}
                      </span>
                    </div>
                    <div className="mb-4">
                      <span className="text-lg font-black text-emerald-400">₹{plan.priceMonthly}</span>
                      <span className="text-slate-500 text-xs">/mo</span>
                      <span className="mx-2 text-slate-700">|</span>
                      <span className="text-sm font-bold text-slate-300">₹{plan.priceYearly}</span>
                      <span className="text-slate-500 text-[10px]">/yr</span>
                    </div>

                    {/* Limits Summary */}
                    <div className="space-y-1 mb-4 border-t border-b border-slate-900 py-3 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Simulations Limit:</span>
                        <span className="text-slate-200 font-bold">
                          {plan.simulationLimit === -1 ? "Unlimited" : plan.simulationLimit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Classroom Students:</span>
                        <span className="text-slate-200 font-bold">
                          {plan.studentLimit === -1 ? "Unlimited" : plan.studentLimit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Instructors Limit:</span>
                        <span className="text-slate-200 font-bold">
                          {plan.instructorLimit === -1 ? "Unlimited" : plan.instructorLimit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Certificates Limit:</span>
                        <span className="text-slate-200 font-bold">
                          {plan.certificateLimit === -1 ? "Unlimited" : plan.certificateLimit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Plan Duration:</span>
                        <span className="text-indigo-400 font-bold">
                          {plan.durationDays} Days
                        </span>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="mb-4">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-bold font-sans">Included Features</p>
                      <div className="flex flex-wrap gap-1">
                        {featureList.map((f, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-slate-900 text-[10px] text-slate-300 border border-slate-800"
                          >
                            {f}
                          </span>
                        ))}
                        {featureList.length === 0 && <span className="text-slate-500 text-[10px]">No custom features.</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleEditStart(plan)}
                    className="w-full mt-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-semibold rounded-xl border border-slate-800 hover:border-slate-700 text-slate-200 transition"
                  >
                    Edit Plan Details & Pricing
                  </button>
                </div>
              );
            })}
            {plans.length === 0 && (
              <div className="col-span-2 text-center text-slate-500 py-12">
                No pricing plans registered in database.
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {activeTab === "reports" && (
      <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-5 gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Subscription Ledgers & Access Logs</h3>
            <p className="text-xs text-slate-400 mt-1">Filter active trial pipelines, expiring institutional cycles, and download audit reports.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (subscriptions.length === 0) {
                  alert("No subscriptions to export");
                  return;
                }
                const formatted = subscriptions.map((sub) => ({
                  ID: sub.id,
                  User: sub.user?.name || "N/A",
                  Email: sub.user?.email || "N/A",
                  Plan: sub.plan?.name || "N/A",
                  PlanCode: sub.plan?.code || "N/A",
                  BillingCycle: sub.billingCycle,
                  Status: sub.status,
                  StartDate: new Date(sub.startDate).toLocaleDateString(),
                  EndDate: new Date(sub.endDate).toLocaleDateString(),
                  GatewaySubId: sub.gatewaySubscriptionId || "N/A"
                }));
                exportToCSV(formatted, `subscriptions_report_${Date.now()}.csv`);
              }}
              className="border border-slate-850 hover:border-slate-750 bg-slate-950 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={() => {
                if (subscriptions.length === 0) {
                  alert("No subscription data to export");
                  return;
                }
                const reportData = {
                  name: `Subscription Reports Overview - ${subStatusFilter.toUpperCase()}`,
                  type: "billing_subscriptions",
                  createdAt: new Date().toLocaleString(),
                  filters: {
                    status: subStatusFilter,
                    searchQuery: subSearchQuery || "none"
                  },
                  data: subscriptions.map(sub => ({
                    user: sub.user?.name,
                    email: sub.user?.email,
                    plan: sub.plan?.name,
                    cycle: sub.billingCycle,
                    status: sub.status,
                    endDate: new Date(sub.endDate).toLocaleDateString()
                  }))
                };
                generatePDF(reportData);
              }}
              className="border border-slate-850 hover:border-slate-750 bg-slate-950 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" /> Export PDF
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-955/40 p-4 border border-slate-850 rounded-2xl">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search user, email, or plan..."
                value={subSearchQuery}
                onChange={(e) => setSubSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-full bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-200 outline-none focus:border-indigo-500/30"
              />
            </div>

            <select
              value={subStatusFilter}
              onChange={(e) => setSubStatusFilter(e.target.value)}
              className="bg-slate-955 border border-slate-850 text-slate-300 text-xs font-bold rounded-xl p-2 outline-none shadow-sm cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="expiring">Expiring (Next 30 Days)</option>
              <option value="cancelled">Cancelled / Inactive</option>
              <option value="trial">Free Trial Cycle</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        {loadingSubscriptions ? (
          <div className="flex items-center justify-center py-20 text-slate-400 font-semibold text-xs">
            <Activity className="h-4 w-4 animate-spin mr-2 text-indigo-400" />
            Synchronizing subscription reports ledger...
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-850">
            <table className="w-full text-left text-xs border-collapse text-slate-300">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Subscriber</th>
                  <th className="py-3.5 px-3">Plan Info</th>
                  <th className="py-3.5 px-3 text-center">Billing Cycle</th>
                  <th className="py-3.5 px-3">Start Date</th>
                  <th className="py-3.5 px-3">End Date</th>
                  <th className="py-3.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-800/10">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-200">{sub.user?.name || "Unknown User"}</div>
                      <div className="text-[10px] text-slate-500 font-medium">{sub.user?.email || "N/A"}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-300">{sub.plan?.name || "N/A"}</div>
                      <div className="inline-block px-1 rounded bg-slate-900 border border-slate-800 text-[9px] text-indigo-400 font-mono mt-0.5">
                        {sub.plan?.code || "N/A"}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center capitalize">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        sub.billingCycle === "yearly"
                          ? "bg-purple-950/80 text-purple-400 border-purple-500/10"
                          : sub.billingCycle === "monthly"
                          ? "bg-blue-950/80 text-blue-400 border-blue-500/10"
                          : "bg-slate-950 text-slate-400 border-slate-800"
                      }`}>
                        {sub.billingCycle}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono">
                      {new Date(sub.startDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono">
                      {new Date(sub.endDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        sub.status === "active"
                          ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/10"
                          : "bg-rose-950/80 text-rose-400 border-rose-500/10"
                      }`}>
                        {sub.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No matching subscription ledgers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}
      </div>
    </div>
  );
}
export default AdminBillingCenter;
