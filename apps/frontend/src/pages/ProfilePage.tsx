import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { useAuthStore } from "@/stores/authStore"
import { normalizeRole } from "@/lib/normalizeRole"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import api from "@/lib/api"
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Calendar,
  Tag,
  ArrowLeft,
  Check
} from "lucide-react"

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()

  const [profileName, setProfileName] = useState("")
  const [profileEmail, setProfileEmail] = useState("")
  const [profilePhone, setProfilePhone] = useState("")
  const [profileUniRole, setProfileUniRole] = useState("")
  const [profileAge, setProfileAge] = useState("")
  const [profileGender, setProfileGender] = useState("")
  const [profileCategory, setProfileCategory] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Load user details
  useEffect(() => {
    if (user) {
      setProfileName(user.name || "")
      setProfileEmail(user.email || "")
      setProfilePhone(user.phoneNumber || "")
      setProfileUniRole(user.universityRole || "")
      setProfileAge(user.age?.toString() || "")
      setProfileGender(user.gender || "")
      setProfileCategory(user.category || "")
    }
  }, [user])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileName.trim()) {
      toast.error("Full Name cannot be empty")
      return
    }
    setIsSaving(true)
    try {
      const res = await api.put<{ success: boolean; user: any }>("/api/v1/users/profile", {
        name: profileName,
        email: profileEmail || undefined,
        phoneNumber: profilePhone || null,
        universityRole: profileUniRole || null,
        age: profileAge ? parseInt(profileAge, 10) : null,
        gender: profileGender || null,
        category: profileCategory || null,
      })
      if (res.data.success) {
        const updated = res.data.user
        if (updated && updated.role) {
          updated.role = updated.role.toLowerCase().replace('_', '-')
        }
        setUser(updated)
        toast.success("Profile details updated successfully!")
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to update profile")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 md:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      {/* Back button */}
      <div className="flex justify-start">
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-1.5 h-8 p-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <Card className="border-neutral-200/80 shadow-lg text-left overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />
        
        <form onSubmit={handleSaveProfile}>
          <CardHeader className="space-y-1.5 p-6 border-b border-neutral-100">
            <CardTitle className="text-2xl font-black text-neutral-900 tracking-tight">
              Edit Profile Details
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-neutral-400">
              Update your personal credentials, contact info, and role mappings below.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            
            {/* Main Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              {/* Full Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="fullName">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Full Name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="pl-9 h-10 text-xs border-neutral-200 bg-white"
                    disabled={isSaving}
                    required
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="emailAddress">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <Input
                    id="emailAddress"
                    type="email"
                    placeholder="name@university.edu"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="pl-9 h-10 text-xs border-neutral-200 bg-white disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-not-allowed"
                    disabled={isSaving || normalizeRole(user?.role) === "INSTRUCTOR"}
                    required
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="phone">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="pl-9 h-10 text-xs border-neutral-200 bg-white"
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Role in University */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="uniRole">
                  Role in University
                </label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <Input
                    id="uniRole"
                    type="text"
                    placeholder="e.g. Professor, Lecturer"
                    value={profileUniRole}
                    onChange={(e) => setProfileUniRole(e.target.value)}
                    className="pl-9 h-10 text-xs border-neutral-200 bg-white"
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Age */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="age">
                  Age
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <Input
                    id="age"
                    type="number"
                    placeholder="e.g. 45"
                    value={profileAge}
                    onChange={(e) => setProfileAge(e.target.value)}
                    className="pl-9 h-10 text-xs border-neutral-200 bg-white"
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Gender Select */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="gender">
                  Gender
                </label>
                <Select value={profileGender} onValueChange={setProfileGender} disabled={isSaving}>
                  <SelectTrigger id="gender" className="w-full h-10 text-xs border-neutral-200 bg-white font-semibold text-neutral-800 focus:ring-slate-900">
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-neutral-200 text-neutral-800">
                    <SelectItem value="Male" className="text-xs">Male</SelectItem>
                    <SelectItem value="Female" className="text-xs">Female</SelectItem>
                    <SelectItem value="Other" className="text-xs">Other</SelectItem>
                    <SelectItem value="Prefer not to say" className="text-xs">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category / Domain */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block" htmlFor="category">
                  Category / Domain
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <Input
                    id="category"
                    type="text"
                    placeholder="e.g. Marketing, Business Administration"
                    value={profileCategory}
                    onChange={(e) => setProfileCategory(e.target.value)}
                    className="pl-9 h-10 text-xs border-neutral-200 bg-white"
                    disabled={isSaving}
                  />
                </div>
              </div>

            </div>

          </CardContent>

          <CardFooter className="bg-neutral-50/50 border-t border-neutral-100 p-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 font-bold text-xs border-neutral-250 bg-white px-5 rounded-xl hover:bg-neutral-50 text-neutral-700 shadow-sm"
              onClick={() => navigate(-1)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            
            <Button
              type="submit"
              className="h-10 font-black bg-slate-900 text-white hover:bg-slate-950 px-6 rounded-xl text-xs flex items-center gap-1.5 shadow-md"
              disabled={isSaving}
            >
              {isSaving ? "Saving Changes..." : "Save Changes"}
              {!isSaving && <Check className="h-4 w-4" />}
            </Button>
          </CardFooter>
        </form>
      </Card>

    </div>
  )
}
export default ProfilePage
