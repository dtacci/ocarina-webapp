"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailField } from "@/components/auth/email-field";
import { PasswordField } from "@/components/auth/password-field";
import { cn } from "@/lib/utils";

type Pending = null | "password" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setPending("password");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setFormError(error.message);
      setPending(null);
      return;
    }

    router.push("/library");
    router.refresh();
  }

  async function handleMagicLink() {
    setFormError(null);
    setEmailError(null);
    if (!email) {
      setEmailError("Enter your email above, then send a magic link.");
      emailRef.current?.focus();
      return;
    }
    setPending("magic");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    });

    if (error) {
      setFormError(error.message);
      setPending(null);
      return;
    }

    setPending(null);
    setMagicSent(true);
  }

  return (
    <AuthShell
      eyebrow="SESSION // SIGN-IN"
      headline="Welcome back to the studio."
      subhead="Pick up where you left off — your kits, recordings, and favorites are waiting behind the console."
    >
      <div className="mb-6 space-y-1.5">
        <h2 className="text-2xl font-heading tracking-tight">Sign in</h2>
        <p className="text-sm text-muted-foreground">
          Use your email + password, or request a one-time magic link.
        </p>
      </div>

      {formError && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {formError}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        <EmailField
          ref={emailRef}
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
            if (magicSent) setMagicSent(false);
          }}
          error={emailError ?? undefined}
          required
        />

        <PasswordField
          label="Password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button
          type="submit"
          size="lg"
          disabled={pending !== null}
          className={cn(
            "group relative h-11 w-full justify-center gap-2 font-medium tracking-wide",
            pending === "password" && "auth-pulse"
          )}
        >
          {pending === "password" ? "Signing in…" : "Sign in"}
          {pending !== "password" && (
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          )}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground/60">
        <span className="h-px flex-1 bg-border/60" />
        or
        <span className="h-px flex-1 bg-border/60" />
      </div>

      {magicSent ? (
        <div
          className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-3 text-sm"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-0.5">
            <p className="font-medium">Magic link sent.</p>
            <p className="text-xs text-muted-foreground">
              Check <span className="text-foreground/80">{email}</span> — follow the link to finish signing in.
            </p>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleMagicLink}
          disabled={pending !== null}
          className="h-11 w-full justify-center gap-2 border-border/70 bg-card/40 font-medium hover:bg-card/70"
        >
          <Mail className="size-4" />
          {pending === "magic" ? "Sending link…" : "Email me a magic link"}
        </Button>
      )}

      <p className="mt-8 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
