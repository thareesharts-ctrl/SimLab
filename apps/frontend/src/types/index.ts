export type UserRole = 'INDIVIDUAL' | 'STUDENT_COLLEGE' | 'INSTRUCTOR' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  institution?: string;
  planType?: string;
  phoneNumber?: string;
  universityRole?: string;
  age?: number;
  gender?: string;
  category?: string;
  createdAt: string;
  status?: string;
  classId?: string;
}

export interface SeoCampaign {
  id: string;
  name: string;
  targetKeywords: string[];
  pagesOptimized: number;
  backlinksAcquired: number;
  organicTraffic: number;
  conversions: number;
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  budget: number;
  bidStrategy: string;
  matchType: string;
  keywords: string[];
  impressions: number;
  clicks: number;
  conversions: number;
  spent: number;
}

export interface MetaAdsCampaign {
  id: string;
  name: string;
  budget: number;
  bidStrategy: string;
  placements: string[];
  targetAudience: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spent: number;
}

export interface Campaign {
  id: string;
  name: string;
  type: 'seo' | 'google-ads' | 'meta-ads';
  status: 'draft' | 'active' | 'paused' | 'completed';
  seoDetails?: SeoCampaign;
  googleAdsDetails?: GoogleAdsCampaign;
  metaAdsDetails?: MetaAdsCampaign;
  createdAt: string;
}

export interface DailyMetrics {
  id: string;
  date: string;
  campaignId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spent: number;
  revenue: number;
}

export interface SimulationRound {
  id: string;
  roundNumber: number;
  scenarioId: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'in-progress' | 'completed';
  decisionLogs: DecisionLog[];
}

export interface MarketEvent {
  id: string;
  title: string;
  description: string;
  type: 'opportunity' | 'threat' | 'neutral';
  impactPercentage: number;
  dayTriggered: number;
}

export interface Class {
  id: string;
  name: string;
  instructorId: string;
  studentsCount: number;
  studentIds: string[];
  createdAt: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  industry: string;
  difficulty: 'easy' | 'medium' | 'hard';
  startingBudget: number;
  targetRevenue: number;
  durationDays: number;
}

export interface ScoreBreakdown {
  id: string;
  scenarioId: string;
  userId: string;
  roiScore: number;
  seoScore: number;
  adsScore: number;
  budgetManagementScore: number;
  overallScore: number;
}

export interface Certificate {
  id: string;
  userId: string;
  scenarioId: string;
  issueDate: string;
  credentialId: string;
  score: number;
}

export interface DecisionLog {
  id: string;
  userId: string;
  roundId: string;
  day: number;
  actionType: string;
  details: string;
  timestamp: string;
}
