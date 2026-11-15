import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AuthButton } from "./AuthButton";

export function Logo({ className = "text-2xl" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 font-black tracking-tight ${className}`}>
      <span>
        Ging<span className="text-ginga">AI</span>
      </span>
      <span className="rounded-full border border-brand/30 px-2 py-0.5 text-[0.55em] font-bold uppercase tracking-wider text-brand">
        teste
      </span>
    </Link>
  );
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <main
      className={`mx-auto flex w-full flex-1 flex-col gap-6 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] ${wide ? "max-w-6xl" : "max-w-md"}`}
    >
      {children}
    </main>
  );
}

export function Header({ right }: { right?: ReactNode }) {
  return (
    <header className="card-baile flex items-center justify-between rounded-2xl bg-white/95 px-4 py-3">
      <Logo />
      {right ?? <AuthButton />}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card-baile rounded-3xl bg-surface p-5 ${className}`}>{children}</section>;
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" };

const VARIANTS = {
  primary: "bg-ginga text-white shadow-md shadow-brand/30 hover:bg-brand-2",
  secondary: "border-2 border-brand bg-white text-brand hover:bg-brand hover:text-white",
  ghost: "bg-transparent text-muted underline-offset-4 hover:underline",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-xl px-5 py-3.5 text-lg font-semibold transition active:scale-[0.98] disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof VARIANTS }) {
  return (
    <Link
      className={`block rounded-xl px-5 py-3.5 text-center text-lg font-semibold transition active:scale-[0.98] ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-3 text-center">
      <p className="font-mono text-xl font-bold">{value}</p>
      <p className="text-xs font-semibold text-muted">{label}</p>
    </div>
  );
}
