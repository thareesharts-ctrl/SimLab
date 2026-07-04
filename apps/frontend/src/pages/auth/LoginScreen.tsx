import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion } from "framer-motion"
import { useAuthStore } from "@/stores/authStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { toast } from "sonner"
import { Mail, Lock, ArrowRight, ShieldAlert } from "lucide-react"
import { normalizeRole, getRoleRedirectPath } from "@/lib/normalizeRole"

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type LoginFormInputs = z.infer<typeof loginSchema>

export function LoginScreen() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true })
    }
  }, [isAuthenticated, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormInputs) => {
    setIsLoading(true)
    try {
      const user = await login(data.email, data.password)
      toast.success("Welcome back to SimLab!")

      const normalizedRole = normalizeRole(user.role)
      const redirectPath = getRoleRedirectPath(user.role)

      // Dev-only role routing log
      if (import.meta.env.DEV) {
        console.info('[SimLab Login]', {
          email: user.email,
          role: user.role,
          normalizedRole,
          redirectTo: redirectPath,
        })
      }

      navigate(redirectPath, { replace: true })
    } catch (err: any) {
      toast.error("Invalid email or password. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200 px-4 sm:px-6 lg:px-8 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md space-y-6"
      >
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-neutral-900 flex items-center justify-center text-white font-black text-2xl shadow-md">
            S
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">
            Welcome Back
          </h2>
          <p className="mt-1.5 text-sm text-neutral-500">
            Login to your digital marketing simulation console
          </p>
        </div>

        <Card className="border-neutral-200/80 shadow-lg">
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Sign In</CardTitle>
              <CardDescription>
                Enter your credentials to access your active session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    className="pl-9 h-10 border-neutral-200 focus-visible:ring-neutral-900"
                    disabled={isLoading}
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs font-semibold text-red-500 animate-in fade-in slide-in-from-top-1 duration-150">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="password">
                    Password
                  </label>
                  <a href="#" className="text-xs font-semibold text-neutral-600 hover:text-neutral-900">
                    Forgot?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9 h-10 border-neutral-200 focus-visible:ring-neutral-900"
                    disabled={isLoading}
                    {...register("password")}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs font-semibold text-red-500 animate-in fade-in slide-in-from-top-1 duration-150">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full h-10 font-bold" disabled={isLoading}>
                {isLoading ? "Signing In..." : "Sign In"}
                {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>

              <div className="text-center w-full text-xs text-neutral-500 space-y-2">
                <div>
                  Looking for pricing plans?{" "}
                  <Link to="/signup" className="font-bold text-neutral-900 hover:underline">
                    View Pricing
                  </Link>
                </div>
                <div>
                  Assigned to a class?{" "}
                  <Link to="/join" className="font-bold text-neutral-900 hover:underline">
                    Join with class code
                  </Link>
                </div>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Portal redirect block */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-neutral-500" />
            <div className="text-left">
              <p className="text-xs font-bold text-neutral-800">Are you an Instructor?</p>
              <p className="text-[10px] text-neutral-400 font-medium">Access classroom metrics & reports</p>
            </div>
          </div>
          <Link to="/instructor-login">
            <Button size="sm" variant="outline" className="h-8 font-semibold text-xs border-neutral-200">
              Instructor Portal
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
export default LoginScreen
