import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, AnimatePresence } from "framer-motion"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { School, User, Mail, Lock, ArrowLeft, ArrowRight } from "lucide-react"
import { normalizeRole } from "@/lib/normalizeRole"

const loginSchema = z.object({
  university: z.string().optional(),
  email: z.string().min(1, "Email is required").email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

const signupSchema = z.object({
  institutionName: z.string().min(1, "Institution name is required"),
  instructorName: z.string().min(1, "Instructor name is required"),
  email: z.string().min(1, "Email is required").email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginFormInputs = z.infer<typeof loginSchema>
type SignupFormInputs = z.infer<typeof signupSchema>

export function InstructorLogin() {
  const navigate = useNavigate()
  const { user, login, registerInstructor, isAuthenticated, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState("login")
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      const normRole = normalizeRole(user?.role)
      if (normRole === "INSTRUCTOR" || normRole === "SUPER_ADMIN") {
        navigate("/instructor", { replace: true })
      } else {
        navigate("/", { replace: true })
      }
    }
  }, [isAuthenticated, user, navigate])

  const loginForm = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  })

  const signupForm = useForm<SignupFormInputs>({
    resolver: zodResolver(signupSchema),
  })

  const onLoginSubmit = async (data: LoginFormInputs) => {
    setIsLoading(true)
    try {
      const loggedUser = await login(data.email, data.password)
      const normRole = normalizeRole(loggedUser.role)
      if (normRole !== "INSTRUCTOR" && normRole !== "SUPER_ADMIN") {
        await logout()
        toast.error("Access denied: Student accounts cannot sign in here.")
        return
      }
      toast.success("Welcome to the Instructor Dashboard!")
      navigate("/instructor", { replace: true })
    } catch (err: any) {
      toast.error("Invalid email or password. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const onSignupSubmit = async (data: SignupFormInputs) => {
    setIsLoading(true)
    try {
      await registerInstructor({
        email: data.email,
        password: data.password,
        name: data.instructorName,
        institution: data.institutionName,
      })
      toast.success(`Account created for ${data.institutionName}!`)
      navigate("/", { replace: true })
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to create instructor account")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Back Link */}
        <div className="flex justify-start">
          <Link to="/login" className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Student Portal</span>
          </Link>
        </div>

        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-neutral-900 flex items-center justify-center text-white font-black text-2xl shadow-md">
            S
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">
            Instructor Portal
          </h2>
          <p className="mt-1.5 text-sm text-neutral-500">
            Manage classrooms, simulation runs, and reports
          </p>
        </div>

        <Card className="border-neutral-200/80 shadow-lg overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="px-4 pt-4">
              <TabsList className="grid grid-cols-2 w-full p-1 bg-neutral-100 border border-neutral-200/50 h-10 rounded-lg">
                <TabsTrigger
                  value="login"
                  className="font-semibold text-xs rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm"
                >
                  Instructor Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="font-semibold text-xs rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm"
                >
                  Register Account
                </TabsTrigger>
              </TabsList>
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "login" && (
                <motion.div
                  key="login-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
                    <CardHeader>
                      <CardTitle className="text-xl">Sign In</CardTitle>
                      <CardDescription>
                        Log in using your course administrator credentials
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* University (cosmetic / display field) */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="login-university">
                          University / Institution <span className="text-neutral-400 normal-case font-normal text-[11px]">(optional)</span>
                        </label>
                        <div className="relative">
                          <School className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                          <Input
                            id="login-university"
                            placeholder="e.g. Stanford University"
                            className="pl-9 h-10 border-neutral-200"
                            disabled={isLoading}
                            {...loginForm.register("university")}
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="login-email">
                          Instructor Email
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                          <Input
                            id="login-email"
                            type="email"
                            placeholder="professor@university.edu"
                            className="pl-9 h-10 border-neutral-200"
                            disabled={isLoading}
                            {...loginForm.register("email")}
                          />
                        </div>
                        {loginForm.formState.errors.email && (
                          <p className="text-xs font-semibold text-red-500">
                            {loginForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      {/* Password */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="login-password">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                          <Input
                            id="login-password"
                            type="password"
                            placeholder="••••••••"
                            className="pl-9 h-10 border-neutral-200"
                            disabled={isLoading}
                            {...loginForm.register("password")}
                          />
                        </div>
                        {loginForm.formState.errors.password && (
                          <p className="text-xs font-semibold text-red-500">
                            {loginForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" className="w-full h-10 font-bold" disabled={isLoading}>
                        {isLoading ? "Signing In..." : "Sign In to Portal"}
                        {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                      </Button>
                    </CardFooter>
                  </form>
                </motion.div>
              )}

              {activeTab === "signup" && (
                <motion.div
                  key="signup-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <form onSubmit={signupForm.handleSubmit(onSignupSubmit)}>
                    <CardHeader>
                      <CardTitle className="text-xl">Create Account</CardTitle>
                      <CardDescription>
                        Set up your educational credentials to host classrooms
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Institution Name */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="institution">
                          University / Institution Name
                        </label>
                        <div className="relative">
                          <School className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                          <Input
                            id="institution"
                            placeholder="Stanford University"
                            className="pl-9 h-10 border-neutral-200"
                            disabled={isLoading}
                            {...signupForm.register("institutionName")}
                          />
                        </div>
                        {signupForm.formState.errors.institutionName && (
                          <p className="text-xs font-semibold text-red-500">
                            {signupForm.formState.errors.institutionName.message}
                          </p>
                        )}
                      </div>

                      {/* Instructor Name */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="instructor-name">
                          Instructor Name
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                          <Input
                            id="instructor-name"
                            placeholder="Dr. Jane Smith"
                            className="pl-9 h-10 border-neutral-200"
                            disabled={isLoading}
                            {...signupForm.register("instructorName")}
                          />
                        </div>
                        {signupForm.formState.errors.instructorName && (
                          <p className="text-xs font-semibold text-red-500">
                            {signupForm.formState.errors.instructorName.message}
                          </p>
                        )}
                      </div>

                      {/* Email */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="signup-email">
                          Instructor Email
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="jsmith@university.edu"
                            className="pl-9 h-10 border-neutral-200"
                            disabled={isLoading}
                            {...signupForm.register("email")}
                          />
                        </div>
                        {signupForm.formState.errors.email && (
                          <p className="text-xs font-semibold text-red-500">
                            {signupForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>

                      {/* Password */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="signup-password">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                          <Input
                            id="signup-password"
                            type="password"
                            placeholder="••••••••"
                            className="pl-9 h-10 border-neutral-200"
                            disabled={isLoading}
                            {...signupForm.register("password")}
                          />
                        </div>
                        {signupForm.formState.errors.password && (
                          <p className="text-xs font-semibold text-red-500">
                            {signupForm.formState.errors.password.message}
                          </p>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" className="w-full h-10 font-bold" disabled={isLoading}>
                        {isLoading ? "Creating Account..." : "Create Instructor Account"}
                      </Button>
                    </CardFooter>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
export default InstructorLogin
