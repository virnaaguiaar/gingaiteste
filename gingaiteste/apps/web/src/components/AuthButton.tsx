"use client";

import Link from "next/link";
import { useAuth } from "@/lib/use-auth";
import { Avatar } from "./Avatar";

/** Ícone oficial do Google (multicolor). */
function GoogleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

/**
 * Botão de autenticação para o cabeçalho: entra com Google ou mostra o usuário logado.
 */
export function AuthButton() {
  const { user, profile, isAdmin, signInWithGoogle, signOut } = useAuth();

  if (user === undefined) {
    return <span className="text-sm text-muted">…</span>;
  }

  if (!user) {
    return (
      <button
        onClick={() => void signInWithGoogle()}
        className="flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold transition active:scale-[0.98]"
      >
        <GoogleIcon />
        Entrar
      </button>
    );
  }

  const name = profile?.nickname || user.email?.split("@")[0] || "Você";

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/eventos"
        className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted"
      >
        Minhas festas
      </Link>
      {isAdmin && (
        <Link
          href="/admin"
          className="rounded-full bg-brand/20 px-3 py-1 text-xs font-bold text-brand-2"
        >
          Admin
        </Link>
      )}
      <Avatar src={profile?.avatar_url} name={name} />
      <button
        onClick={() => void signOut()}
        className="text-sm text-muted underline-offset-4 hover:underline"
      >
        Sair
      </button>
    </div>
  );
}

/** Versão grande, centralizada, para a página de login. */
export function GoogleSignInButton() {
  const { signInWithGoogle } = useAuth();
  return (
    <button
      onClick={() => void signInWithGoogle()}
      className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-brand/30 bg-white px-5 py-3.5 text-lg font-semibold text-neutral-800 transition active:scale-[0.98]"
    >
      <GoogleIcon className="size-6" />
      Entrar com Google
    </button>
  );
}
