import { Link, useLocation } from "react-router"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/uiStore"
import { useAuthStore } from "@/stores/authStore"
import { useState, useEffect } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Play,
  Award,
  Activity,
  Trophy,
  FileBarChart,
  Users,
  CreditCard,
  Receipt,
  Shield,
  Clock,
} from "lucide-react"

interface SubNavItem {
  name: string
  href: string
}

interface NavItem {
  name: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  subItems?: SubNavItem[]
}

interface NavGroup {
  groupName: string
  items: NavItem[]
  role?: string
}

const navConfig: NavGroup[] = [
  {
    groupName: "Dashboard",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard }
    ]
  },
  {
    groupName: "Simulation Lab",
    items: [
      { name: "Simulation Console", href: "/simulation", icon: Play },
      { name: "Daily Campaign Run", href: "/campaign", icon: Activity },
      { name: "Standing Leaderboard", href: "/leaderboard", icon: Trophy },
      { name: "Progress Dashboard", href: "/progress", icon: Activity },
      { name: "Certificate Portal", href: "/certificate", icon: Award },
      { name: "Market Events", href: "/simulation/events", icon: Clock }
    ]
  },
  {
    groupName: "Billing",
    items: [
      { name: "Plans & Pricing", href: "/pricing", icon: CreditCard },
      { name: "My Subscription", href: "/subscription", icon: Activity },
      { name: "Invoices Center", href: "/billing/invoices", icon: Receipt }
    ]
  },
  {
    groupName: "Instructor Panel",
    role: "instructor",
    items: [
      { name: "Classrooms", href: "/instructor", icon: GraduationCap },
      { name: "Scenario Builder", href: "/instructor/scenarios", icon: FileBarChart },
      { name: "Assignments", href: "/instructor/assignments", icon: Clock },
      { name: "Live Leaderboard", href: "/instructor/leaderboard", icon: Trophy },
      { name: "Performance Analytics", href: "/instructor/analytics", icon: Activity },
      { name: "Student Evaluations", href: "/instructor/evaluations", icon: Award },
      { name: "Reports Center", href: "/reports", icon: FileBarChart },
      { name: "Simulation Governance", href: "/instructor/governance", icon: Shield },
      {
        name: "Simulation Sandbox",
        icon: Play,
        subItems: [
          { name: "SEO Simulation", href: "/instructor/simulation/seo" },
          { name: "Google Ads", href: "/instructor/simulation/google-ads" },
          { name: "Meta Ads", href: "/instructor/simulation/meta-ads" }
        ]
      }
    ]
  },
  {
    groupName: "Admin Console",
    role: "admin",
    items: [
      { name: "Admin Dashboard", href: "/admin", icon: LayoutDashboard },
      { name: "User Management", href: "/admin/users", icon: Users },
      { name: "Colleges Tracking", href: "/admin/institutions", icon: GraduationCap },
      { name: "Usage Analytics", href: "/admin/analytics", icon: Activity },
      { name: "Billing Analytics", href: "/admin/billing", icon: CreditCard },
      { name: "Audit Trail Logs", href: "/admin/audit", icon: Award },
      { name: "Role Permissions", href: "/admin/roles", icon: Trophy },
      { name: "Platform Health", href: "/admin/system-health", icon: Activity },
      { name: "Alert Broadcasts", href: "/admin/notifications", icon: Trophy }
    ]
  }
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useUiStore()
  const { user } = useAuthStore()
  const userRole = user?.role || "individual"
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    "Simulation Sandbox": true
  })

  const isActive = (href: string) => {
    if (href === "/") {
      return location.pathname === "/"
    }
    return location.pathname.startsWith(href)
  }

  // Filter groups by role
  const visibleGroups = navConfig.filter(group => {
    if (group.role && group.role !== userRole) return false
    if (userRole === "instructor") {
      if (["Dashboard", "Simulation Lab", "Billing"].includes(group.groupName)) {
        return false
      }
    }
    return true
  })

  // Auto-expand menus containing the active sub-item path
  useEffect(() => {
    const newExpanded: Record<string, boolean> = {}
    visibleGroups.forEach(group => {
      group.items.forEach(item => {
        if (item.subItems?.some(sub => location.pathname === sub.href)) {
          newExpanded[item.name] = true
        }
      })
    })
    setExpandedMenus(prev => ({ ...prev, ...newExpanded }))
  }, [location.pathname])

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          "h-screen bg-white border-r border-neutral-200 flex flex-col transition-all duration-300 shrink-0 sticky top-0 left-0 z-40",
          sidebarCollapsed ? "w-16" : "w-64",
          className
        )}
      >
        {/* Brand logo */}
        <div className="h-16 px-4 border-b border-neutral-100 flex items-center gap-2.5 overflow-hidden">
          <div className="h-9 w-9 rounded-lg bg-neutral-900 flex items-center justify-center text-white font-black text-lg shrink-0">
            S
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col animate-in fade-in duration-200">
              <span className="font-bold text-neutral-900 tracking-tight block">SimpLab</span>
              <span className="text-xs text-neutral-500 font-medium block -mt-0.5">Marketing Platform</span>
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-6 px-3 space-y-6 overflow-y-auto">
          {visibleGroups.map((group) => (
            <div key={group.groupName} className="space-y-1.5">
              {!sidebarCollapsed && (
                <h3 className="px-3 text-[10px] font-bold text-neutral-400 tracking-wider uppercase text-left">
                  {group.groupName}
                </h3>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon

                  if (item.subItems) {
                    const isOpen = !!expandedMenus[item.name]
                    const hasActiveSubItem = item.subItems.some(sub => location.pathname === sub.href)

                    const itemLink = (
                      <button
                        onClick={() => {
                          setExpandedMenus(prev => ({
                            ...prev,
                            [item.name]: !prev[item.name]
                          }))
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 group relative text-left",
                          hasActiveSubItem
                            ? "bg-neutral-50 text-neutral-900 border-l-2 border-neutral-900 rounded-l-none"
                            : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                              hasActiveSubItem ? "text-neutral-900" : "text-neutral-500 group-hover:text-neutral-900"
                            )}
                          />
                          {!sidebarCollapsed && (
                            <span className="truncate">{item.name}</span>
                          )}
                        </div>
                        {!sidebarCollapsed && (
                          <ChevronRight
                            className={cn(
                              "h-3.5 w-3.5 text-neutral-400 transition-transform duration-200",
                              isOpen && "transform rotate-90"
                            )}
                          />
                        )}
                      </button>
                    )

                    if (sidebarCollapsed) {
                      return (
                        <Tooltip key={item.name}>
                          <TooltipTrigger asChild>
                            {itemLink}
                          </TooltipTrigger>
                          <TooltipContent side="right" className="p-2 bg-white border border-neutral-200 shadow-md rounded-lg space-y-1 flex flex-col z-50">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 px-2 pb-1 border-b border-neutral-100 block text-left">{item.name}</span>
                            {item.subItems.map(sub => (
                              <Link
                                key={sub.href}
                                to={sub.href}
                                className={cn(
                                  "block px-2.5 py-1.5 rounded text-xs font-semibold text-left transition-colors whitespace-nowrap",
                                  location.pathname === sub.href
                                    ? "bg-neutral-900 text-white font-bold"
                                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                                )}
                              >
                                {sub.name}
                              </Link>
                            ))}
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    return (
                      <div key={item.name} className="space-y-1">
                        {itemLink}
                        {isOpen && (
                          <div className="pl-9 space-y-1.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-200 text-left">
                            {item.subItems.map(sub => {
                              const subActive = location.pathname === sub.href
                              return (
                                <Link
                                  key={sub.href}
                                  to={sub.href}
                                  className={cn(
                                    "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                                    subActive
                                      ? "text-neutral-900 font-black bg-neutral-100"
                                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                                  )}
                                >
                                  {subActive && <span className="h-1.5 w-1.5 rounded-full bg-neutral-900 shrink-0" />}
                                  <span className="truncate">{sub.name}</span>
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  }

                  const active = item.href ? isActive(item.href) : false
                  const itemLink = (
                    <Link
                      to={item.href || "#"}
                      className={cn(
                        "flex items-center gap-3.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 group relative",
                        active
                          ? "bg-neutral-900 text-white shadow-sm"
                          : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                          active ? "text-white" : "text-neutral-500 group-hover:text-neutral-900"
                        )}
                      />
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.name}</span>
                      )}
                    </Link>
                  )

                  if (sidebarCollapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          {itemLink}
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  return <div key={item.href}>{itemLink}</div>
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse Toggle Footer */}
        <div className="p-3 border-t border-neutral-100 flex justify-end">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 focus:outline-none transition-colors border border-neutral-200/50"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </div>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
export default Sidebar
