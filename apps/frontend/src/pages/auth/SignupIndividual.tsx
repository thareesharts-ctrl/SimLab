import { useState } from "react"
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
import { User, Mail, Lock, Check, CreditCard, ArrowLeft, ArrowRight } from "lucide-react"
import { getRoleRedirectPath } from "@/lib/normalizeRole"

const step1Schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().min(1, "Email is required").email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

type Step1FormInputs = z.infer<typeof step1Schema>

interface Plan {
  id: string
  name: string
  days: number
  price: number
  description: string
}

const PLANS: Plan[] = [
  { id: "7", name: "Weekly Trial", days: 7, price: 15, description: "Perfect for quick trial practice" },
  { id: "15", name: "Sprint Plan", days: 15, price: 29, description: "Recommended for midterm projects" },
  { id: "30", name: "Complete Simulation", days: 30, price: 49, description: "Full coverage for comprehensive courses" },
]

export function SignupIndividual() {
  const navigate = useNavigate()
  const { registerIndividual } = useAuthStore()
  const [step, setStep] = useState(1)
  const [selectedPlanId, setSelectedPlanId] = useState("30")
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<Step1FormInputs>({
    resolver: zodResolver(step1Schema),
  })

  const nextStep = async () => {
    if (step === 1) {
      const isValid = await trigger()
      if (!isValid) return
    }
    setStep((prev) => Math.min(prev + 1, 3))
  }

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleCompleteSignup = async () => {
    setIsLoading(true)
    const { name, email, password } = getValues()
    const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) || PLANS[2]

    try {
      const user = await registerIndividual({
        email,
        password,
        name,
        planType: selectedPlan.id,
      })
      toast.success(`Registered successfully! Active Plan: ${selectedPlan.name}`)
      navigate(getRoleRedirectPath(user?.role))
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to create account")
    } finally {
      setIsLoading(false)
    }
  }

  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) || PLANS[2]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-200 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header indicator */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-neutral-900 flex items-center justify-center text-white font-black text-2xl shadow-md">
            S
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">
            Choose Plan
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
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <CardHeader>
                  <CardTitle className="text-xl">Step 1: Account Details</CardTitle>
                  <CardDescription>
                    Provide your username and credentials for login
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="name">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                      <Input
                        id="name"
                        placeholder="John Doe"
                        className="pl-9 h-10 border-neutral-200"
                        {...register("name")}
                      />
                    </div>
                    {errors.name && (
                      <p className="text-xs font-semibold text-red-500">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Email */}
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
                        className="pl-9 h-10 border-neutral-200"
                        {...register("email")}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs font-semibold text-red-500">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-700 uppercase" htmlFor="password">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-9 h-10 border-neutral-200"
                        {...register("password")}
                      />
                    </div>
                    {errors.password && (
                      <p className="text-xs font-semibold text-red-500">{errors.password.message}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <Button type="button" className="w-full h-10 font-bold" onClick={nextStep}>
                    Choose Pricing Plan
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <div className="text-center w-full text-xs text-neutral-500">
                    Already have an account?{" "}
                    <Link to="/login" className="font-bold text-neutral-900 hover:underline">
                      Sign In
                    </Link>
                  </div>
                </CardFooter>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <CardHeader>
                  <CardTitle className="text-xl">Step 2: Select Duration</CardTitle>
                  <CardDescription>
                    Select access duration matching your course duration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center justify-between ${
                        selectedPlanId === plan.id
                          ? "border-neutral-900 bg-neutral-50/50 shadow-sm"
                          : "border-neutral-200 hover:border-neutral-350"
                      }`}
                    >
                      <div className="space-y-0.5 text-left">
                        <span className="font-bold text-sm text-neutral-900 block">
                          {plan.name} ({plan.days} Days)
                        </span>
                        <span className="text-xs text-neutral-500 block">
                          {plan.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-neutral-950">
                          ${plan.price}
                        </span>
                        <div
                          className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${
                            selectedPlanId === plan.id
                              ? "bg-neutral-900 border-neutral-900 text-white"
                              : "border-neutral-300 bg-white"
                          }`}
                        >
                          {selectedPlanId === plan.id && <Check className="h-3.5 w-3.5" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-10 border-neutral-200" onClick={prevStep}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button className="flex-1 h-10 font-bold" onClick={nextStep}>
                    Review Details
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <CardHeader>
                  <CardTitle className="text-xl">Step 3: Access Preview</CardTitle>
                  <CardDescription>
                    Review your details and initialize your digital simulation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-left">
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/60 space-y-3">
                    <div className="flex justify-between border-b border-neutral-200/50 pb-2">
                      <span className="text-xs text-neutral-500 font-semibold uppercase">Subscriber</span>
                      <span className="text-xs font-bold text-neutral-900">{getValues().name}</span>
                    </div>
                    <div className="flex justify-between border-b border-neutral-200/50 pb-2">
                      <span className="text-xs text-neutral-500 font-semibold uppercase">Pricing Plan</span>
                      <span className="text-xs font-bold text-neutral-900">{selectedPlan.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-neutral-200/50 pb-2">
                      <span className="text-xs text-neutral-500 font-semibold uppercase">Access Duration</span>
                      <span className="text-xs font-bold text-neutral-900">{selectedPlan.days} Days Access</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-sm font-bold text-neutral-800">Total Price</span>
                      <span className="text-sm font-black text-neutral-950">${selectedPlan.price}.00 USD</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-200 bg-amber-50/50 text-amber-800 text-[11px] leading-relaxed font-medium">
                    <CreditCard className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      Demo Mode: No transaction billing will be initiated. Clicking finish grants full simulator rights.
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 border-neutral-200"
                    onClick={prevStep}
                    disabled={isLoading}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    className="flex-1 h-10 font-bold"
                    onClick={handleCompleteSignup}
                    disabled={isLoading}
                  >
                    {isLoading ? "Provisioning..." : "Complete Signup"}
                  </Button>
                </CardFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  )
}
export default SignupIndividual
