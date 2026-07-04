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
import { toast } from "sonner"
import { Hash, User, Mail, Lock, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react"
import api from "@/lib/api"
import { getRoleRedirectPath } from "@/lib/normalizeRole"

const codeSchema = z.object({
  classCode: z
    .string()
    .min(1, "Access code is required")
    .min(3, "Code must be at least 3 characters")
    .max(10, "Code must be at most 10 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Code must contain only alphanumeric characters, hyphens or underscores"),
})

const accountSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().min(1, "Student email is required").email("Please enter a valid student email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type CodeFormInputs = z.infer<typeof codeSchema>
type AccountFormInputs = z.infer<typeof accountSchema>

export function JoinClassScreen() {
  const navigate = useNavigate()
  const { registerStudent, isAuthenticated, user, fetchMe } = useAuthStore()
  const [step, setStep] = useState(1)
  const [validatedCode, setValidatedCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already logged in and belongs to a class
  useEffect(() => {
    if (isAuthenticated && user && user.classId) {
      navigate("/dashboard/student", { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  // Form hooks for separate steps
  const codeForm = useForm<CodeFormInputs>({
    resolver: zodResolver(codeSchema),
  })

  const accountForm = useForm<AccountFormInputs>({
    resolver: zodResolver(accountSchema),
  })

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const isValid = await codeForm.trigger()
    if (!isValid) return

    const code = codeForm.getValues().classCode.toUpperCase()
    setValidatedCode(code)

    if (isAuthenticated) {
      setIsLoading(true)
      try {
        const res = await api.post("/api/v1/users/join-class", {
          inviteCode: code,
        })
        if (res.status === 200) {
          toast.success(`Successfully joined classroom: ${res.data.className || code}`)
          await fetchMe()
          navigate("/dashboard/student", { replace: true })
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || err.message || "Failed to join classroom.")
      } finally {
        setIsLoading(false)
      }
    } else {
      setStep(2)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    const isValid = await accountForm.trigger()
    if (!isValid) return

    setIsLoading(true)
    const { name, email, password } = accountForm.getValues()

    try {
      const user = await registerStudent({
        email,
        password,
        name,
        classJoinCode: validatedCode,
      })
      toast.success(`Successfully joined class ${validatedCode}!`)
      navigate(getRoleRedirectPath(user?.role), { replace: true })
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to join class")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-neutral-900 flex items-center justify-center text-white font-black text-2xl shadow-md">
            S
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">
            Join Classroom
          </h2>
          {/* Progress indicators */}
          <div className="mt-4 flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s === step ? "w-8 bg-neutral-900" : "w-2 bg-neutral-300"
                }`}
              />
            ))}
          </div>
        </div>

        <Card className="border-neutral-200/80 shadow-lg overflow-hidden relative">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="join-step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <form onSubmit={handleValidateCode}>
                  <CardHeader>
                    <CardTitle className="text-xl">Step 1: Class Invite Code</CardTitle>
                    <CardDescription>
                      Enter the simulation class code provided by your course instructor
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="classCode">
                        Access Code
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                          id="classCode"
                          placeholder="SIMP-1234"
                          className="pl-9 h-10 border-neutral-200 uppercase"
                          {...codeForm.register("classCode")}
                        />
                      </div>
                      {codeForm.formState.errors.classCode && (
                        <p className="text-xs font-semibold text-red-500">
                          {codeForm.formState.errors.classCode.message}
                        </p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-4">
                    <Button type="submit" className="w-full h-10 font-bold">
                      Validate Class Code
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <div className="text-center w-full text-xs text-neutral-500">
                      Looking for individual access?{" "}
                      <Link to="/signup" className="font-bold text-neutral-900 hover:underline">
                        View Pricing
                      </Link>
                    </div>
                  </CardFooter>
                </form>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="join-step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <CardHeader>
                  <CardTitle className="text-xl">Step 2: Class Validated</CardTitle>
                  <CardDescription>
                    Ready to create your student account for this classroom
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 flex items-start gap-3.5">
                    <ShieldCheck className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
                    <div className="text-left space-y-2">
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Class Access</span>
                        <span className="text-sm font-bold text-neutral-900 block">Invite Code: {validatedCode}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
                        <div>
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Status</span>
                          <span className="text-xs font-semibold text-neutral-700 block">Code Validated</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Duration</span>
                          <span className="text-xs font-semibold text-neutral-700 block">Course Session</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-10 border-neutral-200" onClick={() => setStep(1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button className="flex-1 h-10 font-bold" onClick={() => setStep(3)}>
                    Create Account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="join-step3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <form onSubmit={handleCreateAccount}>
                  <CardHeader>
                    <CardTitle className="text-xl">Step 3: Create Account</CardTitle>
                    <CardDescription>
                      Create your college student profile for course assignments
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="student-name">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                          id="student-name"
                          placeholder="John Doe"
                          className="pl-9 h-10 border-neutral-200"
                          disabled={isLoading}
                          {...accountForm.register("name")}
                        />
                      </div>
                      {accountForm.formState.errors.name && (
                        <p className="text-xs font-semibold text-red-500">
                          {accountForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="student-email">
                        Student Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                          id="student-email"
                          type="email"
                          placeholder="name@university.edu"
                          className="pl-9 h-10 border-neutral-200"
                          disabled={isLoading}
                          {...accountForm.register("email")}
                        />
                      </div>
                      {accountForm.formState.errors.email && (
                        <p className="text-xs font-semibold text-red-500">
                          {accountForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="student-password">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                        <Input
                          id="student-password"
                          type="password"
                          placeholder="••••••••"
                          className="pl-9 h-10 border-neutral-200"
                          disabled={isLoading}
                          {...accountForm.register("password")}
                        />
                      </div>
                      {accountForm.formState.errors.password && (
                        <p className="text-xs font-semibold text-red-500">
                          {accountForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 h-10 border-neutral-200"
                      onClick={() => setStep(2)}
                      disabled={isLoading}
                      type="button"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      className="flex-1 h-10 font-bold"
                      type="submit"
                      disabled={isLoading}
                    >
                      {isLoading ? "Signing Up..." : "Complete Signup"}
                    </Button>
                  </CardFooter>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  )
}
export default JoinClassScreen
