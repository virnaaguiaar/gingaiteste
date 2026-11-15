"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase/client";
import type { Database } from "./supabase/types";

export type UserProfile = Database["public"]["Tables"]["profiles"]["Row"];

export interface AuthState {
  /** `undefined` = carregando; `null` = deslogado. */
  user: User | null | undefined;
  profile: UserProfile | null;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Sessão do usuário + perfil (com papel) do Supabase. Reage a login/logout em tempo real.
 */
export function useAuth(): AuthState {
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let alive = true;

    const loadProfile = async (uid: string) => {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (alive) setProfile(data ?? null);
    };

    void supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user ?? null);
      if (data.user) void loadProfile(data.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) void loadProfile(u.id);
      else setProfile(null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithGoogle = useCallback(async () => {
    // Guarda o destino no storage (mesmo browser) em vez de query param, para o
    // redirectTo bater EXATAMENTE com a Redirect URL cadastrada no Supabase.
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("gingai:next", window.location.pathname || "/");
      } catch {
        // storage indisponível: o callback cai no destino padrão "/".
      }
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  return {
    user,
    profile,
    isAdmin: profile?.role === "admin",
    signInWithGoogle,
    signOut,
  };
}
