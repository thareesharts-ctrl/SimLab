import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router"
import { AppShell } from "@/components/layout/AppShell"
import { DashboardPage } from "@/pages/Dashboard"
import { InstructorPortal } from "@/pages/InstructorPortal"
import { InstructorGovernance } from "@/pages/InstructorGovernance"
import { CreateClassPage } from "@/pages/CreateClassPage"
import { InstructorAssignmentsPage } from "@/pages/InstructorAssignmentsPage"
import { EditClassPage } from "@/pages/EditClassPage"
import { InstructorScenariosPage } from "@/pages/InstructorScenariosPage"
import { InstructorLeaderboardPage } from "@/pages/InstructorLeaderboardPage"
import { InstructorAnalyticsPage } from "@/pages/InstructorAnalyticsPage"
import { InstructorEvaluationsPage } from "@/pages/InstructorEvaluationsPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { NotificationsPage } from "@/pages/NotificationsPage"
import { SeoSimulationPage } from "@/pages/simulation/SeoSimulationPage"
import { GoogleAdsSimulationPage } from "@/pages/simulation/GoogleAdsSimulationPage"
import { MetaAdsSimulationPage } from "@/pages/simulation/MetaAdsSimulationPage"
import { SimulationHomePage } from "@/pages/simulation/SimulationHomePage"
import { ScenarioBriefingPage } from "@/pages/simulation/ScenarioBriefingPage"
import { SimulationResultsPage } from "@/pages/simulation/SimulationResultsPage"
import { MarketEventsPage } from "@/pages/simulation/MarketEventsPage"
import { MarketAnalysisPage } from "@/pages/simulation/MarketAnalysisPage"
import { MandatoryCheckpointPage } from "@/pages/simulation/MandatoryCheckpointPage"
import { SandboxWorkspace } from "@/pages/simulation/SandboxWorkspace"
import { LoginScreen } from "@/pages/auth/LoginScreen"
import { LeaderboardPage } from "@/pages/LeaderboardPage"
import { ProgressDashboardPage } from "@/pages/ProgressDashboardPage"
import { SignupIndividual } from "@/pages/auth/SignupIndividual"
import { JoinClassScreen } from "@/pages/auth/JoinClassScreen"
import { InstructorLogin } from "@/pages/auth/InstructorLogin"
import { LandingPage } from "@/pages/landing/LandingPage"
import { NotFound } from "@/pages/NotFound"
import { useAuthStore } from "@/stores/authStore"
import { useEffect } from "react"
import { PendingApprovalScreen } from "@/pages/auth/PendingApprovalScreen"
import { BlockedScreen } from "@/pages/auth/BlockedScreen"
import { CampaignDashboard } from "@/pages/campaign/CampaignDashboard"
import { CampaignDecisionPage } from "@/pages/campaign/CampaignDecisionPage"
import { CampaignResultsPage } from "@/pages/campaign/CampaignResultsPage"
import { CampaignTimelinePage } from "@/pages/campaign/CampaignTimelinePage"

// Certificate components
import { CertificatePortal } from "@/pages/CertificatePortal"
import { CertificateViewer } from "@/pages/CertificateViewer"
import { PublicVerificationPage } from "@/pages/PublicVerificationPage"

import { ReportsCenter } from "@/pages/ReportsCenter"
import { NBAReports } from "@/pages/NBAReports"
import { OBEReports } from "@/pages/OBEReports"
import { StudentReport } from "@/pages/StudentReport"
import { InstructorReport } from "@/pages/InstructorReport"

// Admin pages
import { AdminDashboard } from "@/pages/admin/AdminDashboard"
import { AdminUserManagement } from "@/pages/admin/AdminUserManagement"
import { AdminInstitutionManagement } from "@/pages/admin/AdminInstitutionManagement"
import { AdminSystemAnalytics } from "@/pages/admin/AdminSystemAnalytics"
import { AdminAuditLogs } from "@/pages/admin/AdminAuditLogs"
import { AdminRoleManagement } from "@/pages/admin/AdminRoleManagement"
import { AdminSystemHealth } from "@/pages/admin/AdminSystemHealth"
import { AdminNotificationCenter } from "@/pages/admin/AdminNotificationCenter"
import { ErrorReportsDashboard } from "@/pages/admin/ErrorReportsDashboard"
import { TermsOfService } from "@/pages/compliance/TermsOfService"
import { PrivacyPolicy } from "@/pages/compliance/PrivacyPolicy"
import { CookieConsentBanner } from "@/components/shared/CookieConsentBanner"
import { PricingPage } from "@/pages/billing/PricingPage"
import { SubscriptionDashboard } from "@/pages/billing/SubscriptionDashboard"
import { InvoiceCenter } from "@/pages/billing/InvoiceCenter"
import { AdminBillingCenter } from "@/pages/admin/AdminBillingCenter"
import { normalizeRole } from "@/lib/normalizeRole"

// ─── Layout Guards ────────────────────────────────────────────────────────────

/**
 * ProtectedLayout — requires authentication.
 * Handles pending/blocked student status screens.
 */
function ProtectedLayout() {
  const { isAuthenticated, user, fetchMe } = useAuthStore()

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  if (!isAuthenticated) {
    return <Navigate to="/landing" replace />
  }

  // Student status guards
  if (normalizeRole(user?.role) === 'STUDENT') {
    if (user?.status === "pending") {
      return <PendingApprovalScreen />
    }
    if (user?.status && ["rejected", "terminated", "removed"].includes(user.status)) {
      return <BlockedScreen />
    }
  }

  return <AppShell />
}

/**
 * InstructorLayout — only INSTRUCTOR or ADMIN roles may access these routes.
 */
function InstructorLayout() {
  const { user } = useAuthStore()
  const normalized = normalizeRole(user?.role)

  if (user && normalized !== 'INSTRUCTOR' && normalized !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

/**
 * AdminLayout — only ADMIN/SUPER_ADMIN roles may access these routes.
 */
function AdminLayout() {
  const { user } = useAuthStore()
  const normalized = normalizeRole(user?.role)

  if (user && normalized !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

/**
 * SandboxGuard — blocks STUDENT and INSTRUCTOR from personal sandbox routes.
 *
 * STUDENT → redirects to /dashboard (classroom simulation is their path)
 * INSTRUCTOR → redirects to /instructor
 * INDIVIDUAL and SUPER_ADMIN → allowed through
 *
 * This prevents useEffect in SimulationHomePage from firing sandbox API calls
 * before the role check can complete.
 */
function SandboxGuard() {
  const { user } = useAuthStore()
  const normalized = normalizeRole(user?.role)

  if (normalized === 'STUDENT') {
    return <Navigate to="/dashboard" replace />
  }
  if (normalized === 'INSTRUCTOR') {
    return <Navigate to="/instructor" replace />
  }

  return <Outlet />
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function AppRouter() {
  return (
    <BrowserRouter>
      <CookieConsentBanner />
      <Routes>
        {/* Public landing and auth views */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupIndividual />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/join" element={<JoinClassScreen />} />
        <Route path="/instructor-login" element={<InstructorLogin />} />
        
        {/* Public Certificate Verification (No Login Required) */}
        <Route path="/verify/:verificationId" element={<PublicVerificationPage />} />

        {/* Protected workspace console views */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/student" element={<DashboardPage />} />
          <Route path="/dashboard/individual" element={<DashboardPage />} />
          <Route path="/dashboard/instructor" element={<Navigate to="/instructor" replace />} />
          
          {/* Sandbox-only routes — STUDENT and INSTRUCTOR are blocked by SandboxGuard */}
          <Route element={<SandboxGuard />}>
            <Route path="/simulation" element={<SimulationHomePage />} />
            <Route path="/simulation/briefing" element={<ScenarioBriefingPage />} />
            <Route path="/simulation/market-analysis" element={<MarketAnalysisPage />} />
            <Route path="/simulation/seo" element={<SeoSimulationPage />} />
            <Route path="/simulation/google-ads" element={<GoogleAdsSimulationPage />} />
            <Route path="/simulation/meta-ads" element={<MetaAdsSimulationPage />} />
            <Route path="/simulation/results" element={<SimulationResultsPage />} />
            <Route path="/simulation/checkpoint" element={<MandatoryCheckpointPage />} />
            <Route path="/simulation/events" element={<MarketEventsPage />} />
            <Route path="/sandbox" element={<Navigate to="/simulation" replace />} />
            <Route path="/sandbox/workspace" element={<SandboxWorkspace />} />
          </Route>
          
          {/* Daily Campaign Simulation Routes */}
          <Route path="/campaign" element={<CampaignDashboard />} />
          <Route path="/campaign/day/:dayNumber" element={<CampaignDecisionPage />} />
          <Route path="/campaign/results/day/:dayNumber" element={<CampaignResultsPage />} />
          <Route path="/campaign/timeline" element={<CampaignTimelinePage />} />
          
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/progress" element={<ProgressDashboardPage />} />
          
          {/* Certificate Ecosystem Routes */}
          <Route path="/certificate" element={<CertificatePortal />} />
          <Route path="/certificate/view/:certificateId" element={<CertificateViewer />} />

          {/* Billing Platform Routes */}
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/subscription" element={<SubscriptionDashboard />} />
          <Route path="/billing/invoices" element={<InvoiceCenter />} />

          {/* Instructor Only Routes */}
            <Route element={<InstructorLayout />}>
              <Route path="/instructor" element={<InstructorPortal />} />
              <Route path="/instructor/governance" element={<InstructorGovernance />} />
              <Route path="/instructor/create-class" element={<CreateClassPage />} />
              <Route path="/instructor/edit-class/:classId" element={<EditClassPage />} />
              <Route path="/instructor/assignments" element={<InstructorAssignmentsPage />} />
              <Route path="/instructor/scenarios" element={<InstructorScenariosPage />} />
              <Route path="/instructor/leaderboard" element={<InstructorLeaderboardPage />} />
              <Route path="/instructor/analytics" element={<InstructorAnalyticsPage />} />
              <Route path="/instructor/evaluations" element={<InstructorEvaluationsPage />} />
              <Route path="/instructor/classes" element={<Navigate to="/instructor" replace />} />
              <Route path="/instructor/reports" element={<Navigate to="/reports" replace />} />
              <Route path="/instructor/simulation/seo" element={<SeoSimulationPage />} />
            <Route path="/instructor/simulation/google-ads" element={<GoogleAdsSimulationPage />} />
            <Route path="/instructor/simulation/meta-ads" element={<MetaAdsSimulationPage />} />
            <Route path="/reports" element={<ReportsCenter />} />
            <Route path="/reports/nba" element={<NBAReports />} />
            <Route path="/reports/obe" element={<OBEReports />} />
            <Route path="/reports/student/:studentId" element={<StudentReport />} />
            <Route path="/reports/instructor" element={<InstructorReport />} />
          </Route>

          {/* Admin Only Routes */}
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUserManagement />} />
            <Route path="/admin/institutions" element={<AdminInstitutionManagement />} />
            <Route path="/admin/analytics" element={<AdminSystemAnalytics />} />
            <Route path="/admin/audit" element={<AdminAuditLogs />} />
            <Route path="/admin/roles" element={<AdminRoleManagement />} />
            <Route path="/admin/system-health" element={<AdminSystemHealth />} />
            <Route path="/admin/notifications" element={<AdminNotificationCenter />} />
            <Route path="/admin/billing" element={<AdminBillingCenter />} />
            <Route path="/admin/error-reports" element={<ErrorReportsDashboard />} />
          </Route>
          
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/activity" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
