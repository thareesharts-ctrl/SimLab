import { useState, useEffect } from "react"
import { useAdminStore } from "@/stores/adminStore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  UserPlus,
  Trash2,
  Lock,
  UserCheck,
  UserX,
  Activity,
  ArrowLeft,
  Download
} from "lucide-react"
import { Link } from "react-router"
import { toast } from "sonner"
import { normalizeRole } from "@/lib/normalizeRole"

export function AdminUserManagement() {
  const {
    users,
    fetchUsers,
    suspendUser,
    activateUser,
    changeUserRole,
    deleteUser,
    addUser,
    resetUserPassword,
    bulkUserAction,
    isLoading,
    institutions,
    fetchInstitutions,
    updateUserInstitution
  } = useAdminStore()

  // UI local states
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  
  // Provision form state
  const [showProvisionModal, setShowProvisionModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState("student")
  
  // Bulk selection states
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])

  useEffect(() => {
    fetchUsers()
    fetchInstitutions()
  }, [fetchUsers, fetchInstitutions])

  // Filters logic
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.institution || "").toLowerCase().includes(searchQuery.toLowerCase())

    const normalizedUserRole = normalizeRole(user.role)
    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "student" && normalizedUserRole === "STUDENT") ||
      (roleFilter === "instructor" && normalizedUserRole === "INSTRUCTOR") ||
      (roleFilter === "admin" && normalizedUserRole === "SUPER_ADMIN")

    const matchesStatus =
      statusFilter === "all" || user.status === statusFilter

    return matchesSearch && matchesRole && matchesStatus
  })

  // Checkbox handlers
  const handleSelectUser = (id: string) => {
    setSelectedUserIds((prev: string[]) =>
      prev.includes(id) ? prev.filter((uid: string) => uid !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedUserIds.length === filteredUsers.length) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id))
    }
  }

  // Action handlers
  const handleSuspend = async (id: string) => {
    try {
      await suspendUser(id)
      toast.success("User suspended successfully")
    } catch {
      toast.error("Failed to suspend user")
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await activateUser(id)
      toast.success("User activated successfully")
    } catch {
      toast.error("Failed to activate user")
    }
  }

  const handleResetPassword = async (id: string) => {
    if (confirm("Are you sure you want to reset this user's password to default?")) {
      try {
        await resetUserPassword(id)
        toast.success("Password reset to ResetPassword123!")
      } catch {
        toast.error("Failed to reset password")
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this user? All associated simulation state will be wiped.")) {
      try {
        await deleteUser(id)
        toast.success("User deleted successfully")
      } catch {
        toast.error("Failed to delete user")
      }
    }
  }

  const handleRoleChange = async (id: string, role: "student" | "instructor" | "admin") => {
    try {
      await changeUserRole(id, role)
      toast.success("Role updated successfully")
    } catch {
      toast.error("Failed to update role")
    }
  }

  const handleBulkAction = async (action: "suspend" | "activate" | "delete") => {
    if (selectedUserIds.length === 0) return
    if (confirm(`Are you sure you want to bulk ${action} these ${selectedUserIds.length} users?`)) {
      try {
        await bulkUserAction(selectedUserIds, action)
        setSelectedUserIds([])
        toast.success(`Bulk ${action} execution completed`)
      } catch {
        toast.error(`Bulk ${action} execution failed`)
      }
    }
  }

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await addUser({
        name: newName,
        email: newEmail,
        role: newRole as any,
        status: "active",
        classCount: 0,
        totalScore: 0
      })
      toast.success("User provisioned successfully")
      setShowProvisionModal(false)
      setNewName("")
      setNewEmail("")
      setNewRole("student")
    } catch {
      toast.error("Failed to provision user")
    }
  }

  const handleExportCSV = () => {
    if (filteredUsers.length === 0) {
      toast.error("No users to export")
      return
    }
    const headers = ["id", "name", "email", "role", "status", "institution", "classCount", "totalScore"]
    const rows = filteredUsers.map(u => [
      u.id,
      u.name,
      u.email,
      u.role,
      u.status,
      u.institution || "",
      u.classCount,
      u.totalScore.toFixed(2)
    ])
    const csvContent = [headers.join(","), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `users_export_${Date.now()}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("CSV export downloaded")
  }

  const handleExportJSON = () => {
    if (filteredUsers.length === 0) {
      toast.error("No users to export")
      return
    }
    const blob = new Blob([JSON.stringify(filteredUsers, null, 2)], { type: "application/json;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `users_export_${Date.now()}.json`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("JSON export downloaded")
  }

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-5">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="p-2 hover:bg-neutral-50 rounded-lg border border-neutral-200 transition-colors">
            <ArrowLeft className="h-4 w-4 text-neutral-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
              User Directory & Account Controls
            </h1>
            <p className="text-sm text-neutral-500 font-semibold">
              Provision, assign roles, reset credentials, and adjust access status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="border-neutral-200 text-neutral-700 font-semibold flex items-center gap-1.5 text-xs h-9 px-3"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            onClick={handleExportJSON}
            variant="outline"
            className="border-neutral-200 text-neutral-700 font-semibold flex items-center gap-1.5 text-xs h-9 px-3"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
          <Button
            onClick={() => setShowProvisionModal(true)}
            className="bg-neutral-900 hover:bg-neutral-800 text-white font-semibold flex items-center gap-1.5 text-xs h-9 px-3"
          >
            <UserPlus className="h-4 w-4" />
            Provision User
          </Button>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 border border-neutral-200/60 rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-neutral-50 focus:bg-white text-xs border-neutral-250/70"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white border border-neutral-200 text-neutral-800 text-xs font-bold rounded-lg p-2.5 outline-none shadow-sm cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
            <option value="admin">Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-neutral-200 text-neutral-800 text-xs font-bold rounded-lg p-2.5 outline-none shadow-sm cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending Approval</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedUserIds.length > 0 && (
          <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-250">
            <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">{selectedUserIds.length} Selected:</span>
            <Button
              onClick={() => handleBulkAction("suspend")}
              variant="outline"
              size="sm"
              className="border-neutral-200 text-neutral-700 font-bold text-xs"
            >
              Suspend
            </Button>
            <Button
              onClick={() => handleBulkAction("activate")}
              variant="outline"
              size="sm"
              className="border-neutral-200 text-neutral-700 font-bold text-xs"
            >
              Activate
            </Button>
            <Button
              onClick={() => handleBulkAction("delete")}
              variant="destructive"
              size="sm"
              className="font-bold text-xs"
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Users List Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-neutral-500 font-semibold text-sm">
          <Activity className="h-5 w-5 animate-spin mr-2" />
          Synchronizing records ledger...
        </div>
      ) : (
        <Card className="border-neutral-200/60 shadow-sm">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold text-neutral-700">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-neutral-350 focus:ring-0 accent-neutral-900 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 text-neutral-500 font-bold">User</th>
                  <th className="py-3 px-2 text-neutral-500 font-bold">Role Assignment</th>
                  <th className="py-3 px-2 text-neutral-500 font-bold">Institution / College</th>
                  <th className="py-3 px-2 text-center text-neutral-500 font-bold">Activity Score</th>
                  <th className="py-3 px-2 text-center text-neutral-500 font-bold">Account Access</th>
                  <th className="py-3 px-4 text-right text-neutral-500 font-bold">Ledger Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50/40 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => handleSelectUser(user.id)}
                        className="rounded border-neutral-350 focus:ring-0 accent-neutral-900 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-neutral-850">{user.name}</p>
                      <p className="text-[10px] text-neutral-400 font-medium">{user.email}</p>
                    </td>
                    <td className="py-3 px-2">
                      <select
                        value={(() => {
                          const norm = normalizeRole(user.role);
                          if (norm === 'SUPER_ADMIN') return 'admin';
                          if (norm === 'INSTRUCTOR') return 'instructor';
                          return 'student';
                        })()}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                        className="bg-transparent border-none text-neutral-800 text-xs font-bold focus:ring-0 outline-none p-0 cursor-pointer"
                      >
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                     <td className="py-3 px-2">
                      <select
                        value={user.institution || ""}
                        onChange={async (e) => {
                          const val = e.target.value;
                          try {
                            await updateUserInstitution(user.id, val === "" ? null : val);
                            toast.success("Institution updated successfully");
                          } catch {
                            toast.error("Failed to update institution");
                          }
                        }}
                        className="bg-transparent border-none text-neutral-800 text-xs font-bold focus:ring-0 outline-none p-0 cursor-pointer max-w-[155px]"
                      >
                        <option value="">No Institution</option>
                        {institutions.map((inst) => (
                          <option key={inst.name} value={inst.name}>
                            {inst.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-bold text-neutral-800">
                      {user.totalScore.toFixed(1)}%
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge className={`border-none text-[9px] font-bold ${
                        user.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : user.status === "suspended"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-neutral-100 text-neutral-650"
                      }`}>
                        {user.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === "active" ? (
                          <button
                            onClick={() => handleSuspend(user.id)}
                            className="p-1 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 rounded"
                            title="Suspend Account"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(user.id)}
                            className="p-1 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 rounded"
                            title="Activate Account"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleResetPassword(user.id)}
                          className="p-1 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 rounded"
                          title="Reset Password"
                        >
                          <Lock className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Delete Account"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Provision Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-neutral-200/80 shadow-lg rounded-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-neutral-900 tracking-tight">Provision New User</h3>
            <p className="text-xs text-neutral-400 font-semibold mb-4 mt-0.5">Creates an account and auto-verifies their email profile.</p>

            <form onSubmit={handleProvision} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Display Name</label>
                <Input
                  required
                  placeholder="John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-neutral-55 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Email Address</label>
                <Input
                  required
                  type="email"
                  placeholder="john@school.edu"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="bg-neutral-55 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Role Assignment</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-neutral-55 border border-neutral-200 text-neutral-800 text-sm font-semibold rounded-lg p-2.5 outline-none shadow-sm cursor-pointer"
                >
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  variant="outline"
                  className="border-neutral-200 text-neutral-700 font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-neutral-900 hover:bg-neutral-800 text-white font-semibold"
                >
                  Provision Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default AdminUserManagement
