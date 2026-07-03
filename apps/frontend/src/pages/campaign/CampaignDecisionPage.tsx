import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useDailyCampaignStore } from "@/stores/dailyCampaignStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { AVAILABLE_KEYWORDS } from "@/stores/campaignStore";
import { 
  ArrowLeft, Search, Sliders, Globe, RefreshCw,
  ShieldAlert, CheckCircle
} from "lucide-react";

export function CampaignDecisionPage() {
  const { dayNumber } = useParams<{ dayNumber: string }>();
  const navigate = useNavigate();
  const { activeRun, saveDecision, fetchState } = useDailyCampaignStore();

  const targetDay = parseInt(dayNumber || "1");

  // Local Form States
  const [activeTab, setActiveTab] = useState<"seo" | "google" | "meta">("seo");
  
  // SEO
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [contentQuality, setContentQuality] = useState<number>(5);
  const [backlinkBudget, setBacklinkBudget] = useState<number>(0);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [h1Header, setH1Header] = useState("");
  const [bodyContent, setBodyContent] = useState("");

  // Google Ads
  const [googleCampaigns, setGoogleCampaigns] = useState<any[]>([]);
  
  // Meta Ads
  const [metaCampaigns, setMetaCampaigns] = useState<any[]>([]);

  const simulationMode = activeRun?.assignment?.simulationMode || activeRun?.scenario?.simulationMode;

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (simulationMode) {
      if (simulationMode === "GOOGLE_ADS") setActiveTab("google");
      else if (simulationMode === "META_ADS") setActiveTab("meta");
      else if (simulationMode === "SEO") setActiveTab("seo");
    }
  }, [simulationMode]);

  useEffect(() => {
    // Populate form if there's previous data or active decision
    if (activeRun) {
      const prevDec = (activeRun as any).decisions?.find((d: any) => d.dayNumber === targetDay);
      if (prevDec) {
        const seo = prevDec.seoSettingsJson as any;
        setSelectedKeywords(seo.targetKeywords || []);
        setContentQuality(seo.contentQuality || 5);
        setBacklinkBudget(seo.backlinkBudget || 0);
        setMetaTitle(seo.metaTitle || "");
        setMetaDescription(seo.metaDescription || "");
        setH1Header(seo.h1Header || "");
        setBodyContent(seo.bodyContent || "");

        const google = prevDec.googleAdsSettingsJson as any;
        setGoogleCampaigns(google.campaigns || []);

        const meta = prevDec.metaAdsSettingsJson as any;
        setMetaCampaigns(meta.campaigns || []);
      }
    }
  }, [activeRun, targetDay]);

  if (!activeRun) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin" />
        <span className="text-sm text-neutral-500 font-bold">Checking campaign context...</span>
      </div>
    );
  }

  const currentDay = activeRun.currentDay;
  const isEditable = activeRun.status === "ACTIVE" && targetDay === currentDay;
  const isPast = targetDay < currentDay;
  const isFuture = targetDay > currentDay;
  const budgetCap = activeRun.scenario?.dailyBudgetCap || 50;

  // Compute total proposed spend
  const totalGoogleBudget = googleCampaigns.reduce((sum, c) => sum + (parseFloat(c.budget) || 0), 0);
  const totalMetaBudget = metaCampaigns.reduce((sum, c) => sum + (parseFloat(c.budget) || 0), 0);
  const totalProposedSpend = backlinkBudget + totalGoogleBudget + totalMetaBudget;

  const handleToggleKeyword = (kwName: string) => {
    if (!isEditable) return;
    if (selectedKeywords.includes(kwName)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== kwName));
    } else {
      if (selectedKeywords.length >= 5) {
        toast.warning("You can target a maximum of 5 keywords daily.");
        return;
      }
      setSelectedKeywords([...selectedKeywords, kwName]);
    }
  };

  const handleAddGoogleCampaign = () => {
    if (!isEditable) return;
    setGoogleCampaigns([
      ...googleCampaigns,
      {
        id: crypto.randomUUID(),
        name: `Google Search Campaign ${googleCampaigns.length + 1}`,
        budget: 10,
        objective: "Sales",
        biddingStrategy: "Manual CPC",
        keywords: selectedKeywords.map(word => ({ word, bid: 1.5 })),
      },
    ]);
  };

  const handleRemoveGoogleCampaign = (id: string) => {
    if (!isEditable) return;
    setGoogleCampaigns(googleCampaigns.filter(c => c.id !== id));
  };

  const handleUpdateGoogleCampaign = (id: string, field: string, value: any) => {
    if (!isEditable) return;
    setGoogleCampaigns(
      googleCampaigns.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleAddMetaCampaign = () => {
    if (!isEditable) return;
    setMetaCampaigns([
      ...metaCampaigns,
      {
        id: crypto.randomUUID(),
        name: `Meta Traffic Campaign ${metaCampaigns.length + 1}`,
        budget: 10,
        audienceInterest: "general-broad",
        placement: "auto",
        objective: "traffic",
        creative: {
          headline: "Discover the new SimLab E-Store!",
          primaryText: "Get high quality goods today.",
        },
      },
    ]);
  };

  const handleRemoveMetaCampaign = (id: string) => {
    if (!isEditable) return;
    setMetaCampaigns(metaCampaigns.filter(c => c.id !== id));
  };

  const handleUpdateMetaCampaign = (id: string, field: string, value: any) => {
    if (!isEditable) return;
    setMetaCampaigns(
      metaCampaigns.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleFormSubmit = async () => {
    if (!isEditable) return;
    if ((!simulationMode || simulationMode === "SEO") && selectedKeywords.length === 0) {
      toast.error("Please target at least one keyword for SEO.");
      return;
    }

    if (totalProposedSpend > budgetCap) {
      toast.error(`Your proposed spend ($${totalProposedSpend}) exceeds the daily budget cap of $${budgetCap}.`);
      return;
    }

    const success = await saveDecision(
      targetDay,
      {
        targetKeywords: selectedKeywords,
        contentQuality,
        backlinkBudget,
        metaTitle,
        metaDescription,
        h1Header,
        bodyContent,
      },
      { campaigns: googleCampaigns },
      { campaigns: metaCampaigns }
    );

    if (success) {
      navigate("/campaign");
    }
  };

  const availableTabs = [
    { id: "seo", label: "Search Engine Optimization", icon: Globe, modeKey: "SEO" },
    { id: "google", label: "Google Pay-Per-Click", icon: Search, modeKey: "GOOGLE_ADS" },
    { id: "meta", label: "Meta Paid Social", icon: Sliders, modeKey: "META_ADS" },
  ].filter(t => !simulationMode || t.modeKey === simulationMode);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 text-left animate-in fade-in duration-300">
      
      {/* Navigation & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link to="/campaign">
            <Button variant="outline" size="icon" className="rounded-full border-neutral-200">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
              Day {targetDay} Settings Editor
            </h1>
            <p className="text-xs text-neutral-500 font-semibold mt-0.5">
              Scenario Cap: <span className="font-bold text-neutral-800">${budgetCap}</span> daily
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {simulationMode && (
            <Badge className="bg-indigo-50 text-indigo-805 border border-indigo-200 font-bold px-3.5 py-1 rounded-full text-[10px] uppercase">
              Class Simulation Type: {simulationMode.replace('_', ' ')}
            </Badge>
          )}
          {isPast && (
            <Badge className="bg-neutral-100 text-neutral-600 border border-neutral-200 font-bold px-3.5 py-1 rounded-full text-[10px] uppercase">
              Locked (Past Day)
            </Badge>
          )}
          {isFuture && (
            <Badge className="bg-rose-50 text-rose-800 border border-rose-200 font-bold px-3.5 py-1 rounded-full text-[10px] uppercase">
              Locked (Future Day)
            </Badge>
          )}
          {isEditable && (
            <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-3.5 py-1 rounded-full text-[10px] uppercase animate-pulse">
              Editable (Today)
            </Badge>
          )}
        </div>
      </div>

      {/* Locking Warning Alert */}
      {isFuture && (
        <Card className="bg-rose-50 border-rose-200 p-4 flex items-start gap-3 rounded-2xl">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed font-semibold text-rose-800">
            This campaign day is locked. You can configure and submit daily decisions only when this day becomes active on the timeline.
          </div>
        </Card>
      )}

      {/* Editor Tabs */}
      <div className="flex border-b border-neutral-200">
        {availableTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3.5 font-bold text-xs border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-indigo-650 text-indigo-650"
                  : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Form Content */}
      <div className="min-h-[40vh]">
        {activeTab === "seo" && (
          <div className="space-y-6">
            <Card className="p-6 bg-white border-neutral-200/80 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-black text-neutral-800">Target Search Keywords</h3>
                <p className="text-xs text-neutral-500 font-semibold mt-0.5">Select up to 5 keywords to optimize and index</p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {AVAILABLE_KEYWORDS.map(kw => {
                  const selected = selectedKeywords.includes(kw.name);
                  return (
                    <button
                      key={kw.id}
                      disabled={!isEditable}
                      onClick={() => handleToggleKeyword(kw.name)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                        selected
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
                      }`}
                    >
                      {kw.name} <span className="text-[10px] opacity-70">(${kw.cpc} cpc)</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 bg-white border-neutral-200/80 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-black text-neutral-800">On-Page Content Settings</h3>
                  <p className="text-xs text-neutral-500 font-semibold mt-0.5">Set content quality parameters</p>
                </div>

                <div className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Content Quality Rating</span>
                      <span className="text-indigo-600 font-bold">{contentQuality} / 10</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      disabled={!isEditable}
                      value={contentQuality}
                      onChange={e => setContentQuality(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-neutral-500">Meta Title Tag</span>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={metaTitle}
                      onChange={e => setMetaTitle(e.target.value)}
                      placeholder="e.g. Premium Sports Gear | SimLab"
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-neutral-500">Meta Description</span>
                    <textarea
                      disabled={!isEditable}
                      value={metaDescription}
                      onChange={e => setMetaDescription(e.target.value)}
                      placeholder="Enter meta description for search result snippet"
                      rows={2}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white border-neutral-200/80 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-black text-neutral-800">SEO Backlinks & Headers</h3>
                  <p className="text-xs text-neutral-500 font-semibold mt-0.5">Acquire backlinks and set header structures</p>
                </div>

                <div className="space-y-4 text-xs font-semibold">
                  <div className="space-y-1.5">
                    <span className="text-neutral-500">Backlink Budget ($)</span>
                    <input
                      type="number"
                      disabled={!isEditable}
                      value={backlinkBudget}
                      onChange={e => setBacklinkBudget(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-neutral-500">H1 Tag Header</span>
                    <input
                      type="text"
                      disabled={!isEditable}
                      value={h1Header}
                      onChange={e => setH1Header(e.target.value)}
                      placeholder="e.g. Shop Premium Sports & Footwear"
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-neutral-500">Body Landing Text Content</span>
                    <textarea
                      disabled={!isEditable}
                      value={bodyContent}
                      onChange={e => setBodyContent(e.target.value)}
                      placeholder="Write descriptive high relevancy body content copy..."
                      rows={2}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "google" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-neutral-800">Google Ads Campaigns</h3>
                <p className="text-xs text-neutral-500 font-semibold mt-0.5">Configure daily Pay-Per-Click campaigns</p>
              </div>
              {isEditable && (
                <Button onClick={handleAddGoogleCampaign} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-9 rounded-xl">
                  + Add Campaign
                </Button>
              )}
            </div>

            {googleCampaigns.length === 0 ? (
              <div className="bg-neutral-50 border border-neutral-200/80 p-8 text-center rounded-2xl text-xs font-bold text-neutral-400">
                No Google Ads campaigns configured. Click "+ Add Campaign" to build one.
              </div>
            ) : (
              <div className="space-y-4">
                {googleCampaigns.map(camp => (
                  <Card key={camp.id} className="p-6 bg-white border-neutral-200/80 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={camp.name}
                        onChange={e => handleUpdateGoogleCampaign(camp.id, "name", e.target.value)}
                        className="font-black text-sm text-neutral-800 bg-transparent border-b border-dashed border-neutral-300 focus:outline-none focus:border-indigo-500"
                      />
                      {isEditable && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleRemoveGoogleCampaign(camp.id)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs h-8 px-2.5 rounded-lg"
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold">
                      <div className="space-y-1">
                        <span className="text-neutral-500 block">Daily Budget ($)</span>
                        <input
                          type="number"
                          disabled={!isEditable}
                          value={camp.budget}
                          onChange={e => handleUpdateGoogleCampaign(camp.id, "budget", Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-neutral-500 block">Objective</span>
                        <select
                          disabled={!isEditable}
                          value={camp.objective}
                          onChange={e => handleUpdateGoogleCampaign(camp.id, "objective", e.target.value)}
                          className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl bg-white focus:outline-none"
                        >
                          <option>Sales</option>
                          <option>Leads</option>
                          <option>Website Traffic</option>
                          <option>Brand Awareness</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-neutral-500 block">Bidding Strategy</span>
                        <select
                          disabled={!isEditable}
                          value={camp.biddingStrategy}
                          onChange={e => handleUpdateGoogleCampaign(camp.id, "biddingStrategy", e.target.value)}
                          className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl bg-white focus:outline-none"
                        >
                          <option>Manual CPC</option>
                          <option>Maximize Clicks</option>
                          <option>Maximize Conversions</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-neutral-500 block">Negative Keywords Count</span>
                        <input
                          type="number"
                          disabled={!isEditable}
                          defaultValue={(camp.negativeKeywords || []).length}
                          onChange={e => handleUpdateGoogleCampaign(camp.id, "negativeKeywords", new Array(Math.max(0, parseInt(e.target.value) || 0)).fill("negative"))}
                          className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "meta" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-neutral-800">Meta Ads Social Campaigns</h3>
                <p className="text-xs text-neutral-500 font-semibold mt-0.5">Configure Facebook and Instagram daily creatives</p>
              </div>
              {isEditable && (
                <Button onClick={handleAddMetaCampaign} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-9 rounded-xl">
                  + Add Campaign
                </Button>
              )}
            </div>

            {metaCampaigns.length === 0 ? (
              <div className="bg-neutral-50 border border-neutral-200/80 p-8 text-center rounded-2xl text-xs font-bold text-neutral-400">
                No Meta Ads campaigns configured. Click "+ Add Campaign" to build one.
              </div>
            ) : (
              <div className="space-y-4">
                {metaCampaigns.map(camp => (
                  <Card key={camp.id} className="p-6 bg-white border-neutral-200/80 shadow-sm space-y-4">
                    <div className="flex justify-between items-center">
                      <input
                        type="text"
                        disabled={!isEditable}
                        value={camp.name}
                        onChange={e => handleUpdateMetaCampaign(camp.id, "name", e.target.value)}
                        className="font-black text-sm text-neutral-800 bg-transparent border-b border-dashed border-neutral-300 focus:outline-none focus:border-indigo-500"
                      />
                      {isEditable && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleRemoveMetaCampaign(camp.id)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs h-8 px-2.5 rounded-lg"
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
                      <div className="space-y-1">
                        <span className="text-neutral-500 block">Daily Budget ($)</span>
                        <input
                          type="number"
                          disabled={!isEditable}
                          value={camp.budget}
                          onChange={e => handleUpdateMetaCampaign(camp.id, "budget", Math.max(0, parseFloat(e.target.value) || 0))}
                          className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-neutral-500 block">Target Audience Group</span>
                        <select
                          disabled={!isEditable}
                          value={camp.audienceInterest}
                          onChange={e => handleUpdateMetaCampaign(camp.id, "audienceInterest", e.target.value)}
                          className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl bg-white focus:outline-none"
                        >
                          <option value="general-broad">General Broad Audience</option>
                          <option value="business-owners">Business Owners / Founders</option>
                          <option value="tech-enthusiasts">Tech Enthusiasts</option>
                          <option value="fashion-lifestyle">Fashion & Lifestyle Shoppers</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-neutral-500 block">Placement Strategy</span>
                        <select
                          disabled={!isEditable}
                          value={camp.placement}
                          onChange={e => handleUpdateMetaCampaign(camp.id, "placement", e.target.value)}
                          className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl bg-white focus:outline-none"
                        >
                          <option value="auto">Advantage+ Automatic Placement</option>
                          <option value="facebook_only">Facebook Feed Only</option>
                          <option value="instagram_only">Instagram Reels & Stories</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold pt-3 border-t border-neutral-100">
                      <div className="space-y-1">
                        <span className="text-neutral-500 block">Creative Headline Copy</span>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={camp.creative?.headline}
                          onChange={e => handleUpdateMetaCampaign(camp.id, "creative", { ...camp.creative, headline: e.target.value })}
                          className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-neutral-500 block">Creative Primary Text Copy</span>
                        <input
                          type="text"
                          disabled={!isEditable}
                          value={camp.creative?.primaryText}
                          onChange={e => handleUpdateMetaCampaign(camp.id, "creative", { ...camp.creative, primaryText: e.target.value })}
                          className="w-full px-3 py-1.5 border border-neutral-200 rounded-xl focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Submission Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-neutral-50 border border-neutral-200 p-5 rounded-2xl">
        <div className="text-left">
          <span className="text-[10px] font-black text-neutral-400 uppercase block">Daily Budget Allocation</span>
          <span className={`text-base font-black block mt-0.5 ${totalProposedSpend > budgetCap ? "text-rose-600 animate-pulse" : "text-neutral-800"}`}>
            ${totalProposedSpend} of ${budgetCap} limit
          </span>
        </div>

        {isEditable && (
          <Button
            onClick={handleFormSubmit}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-10 px-6 rounded-xl flex items-center gap-1.5"
          >
            <CheckCircle className="h-4.5 w-4.5" />
            Submit Day {targetDay} Decisions
          </Button>
        )}
      </div>

    </div>
  );
}
export default CampaignDecisionPage;
