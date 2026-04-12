"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailField } from "@/components/auth/email-field";
import { PasswordField } from "@/components/auth/password-field";
import { cn } from "@/lib/utils";

interface FieldErrors {
  email?: string;
  password?: string;
  confirm?: string;
}

function scorePassword(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (pw.length === 0) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^\w\s]/.test(pw)) score++;
  const labels = ["Too short", "Weak", "Okay", "Strong", "Excellent"] as const;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  return { score: clamped, label: labels[clamped] };
}

export default function SignupPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const strength = useMemo(() => scorePassword(password), [password]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: FieldErrors = {};

    if (password.length < 6) {
      next.password = "Use at least 6 characters.";
    }
    if (password !== confirmPassword) {
      next.confirm = "Passwords don't match.";
    }
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    });

    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }

    // If email confirmation is required, no session will be returned yet.
    if (!data.session) {
      setEmailSent(true);
      setSubmitting(false);
      return;
    }

    router.push("/library");
    router.refresh();
  }

  return (
    <AuthShell
      eyebrow="SESSION // NEW ACCOUNT"
      headline="Start a new session."
      subhead="Create an account to save kits, sync recordings from your Ocarina, and shape a library that's yours."
    >
      <div className="mb-6 space-y-1.5">
        <h2 className="text-2xl font-heading tracking-tight">Create account</h2>
        <p className="text-sm text-muted-foreground">
          Free while in beta. No credit card needed.
        </p>
      </div>

      {formError && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {formError}
        </div>
      )}

      {emailSent ? (
        <div
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-3 text-sm"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-0.5">
            <p className="font-medium">Check your inbox.</p>
            <p className="text-xs text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="text-foreground/80">{email}</span>. Click it to
              activate your account.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSignup} className="space-y-4" noValidate>
          <EmailField
            ref={emailRef}
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            required
          />

          <div className="space-y-2">
            <PasswordField
              label="Password"
              placeholder="At least 6 characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((f) => ({ ...f, password: undefined }));
                }
              }}
              error={fieldErrors.password}
              required
              hint={strength.label || undefined}
            />
            <StrengthBar score={strength.score} />
          </div>

          <PasswordField
            label="Confirm password"
            placeholder="Re-enter to confirm"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldErrors.confirm) {
                setFieldErrors((f) => ({ ...f, confirm: undefined }));
              }
            }}
            error={fieldErrors.confirm}
            required
          />

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className={cn(
              "group relative h-11 w-full justify-center gap-2 font-medium tracking-wide",
              submitting && "auth-pulse"
            )}
          >
            {submitting ? "Creating account…" : "Create account"}
            {!submitting && (
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            )}
          </Button>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground/80">
            By continuing you agree to the beta-terms.
            Your library is private by default.
          </p>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already signed up?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

function StrengthBar({ score }: { score: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {[0, 1, 2, 3].map((i) => {
        const filled = i < score;
        return (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              filled
                ? score >= 3
                  ? "bg-primary"
                  : score >= 2
                    ? "bg-amber-500/70"
                    : "bg-muted-foreground/60"
                : "bg-muted"
            )}
          />
        );
      })}
    </div>
  );
}
