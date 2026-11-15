import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

/**
 * Renova a sessão do Supabase a cada navegação e repassa os cookies atualizados.
 * Sem isto, o token de acesso expira e o usuário é deslogado silenciosamente.
 * (Antes chamado "middleware"; renomeado para "proxy" no Next 16.)
 */
export async function proxy(request: NextRequest) {
  // Rede de segurança: se o OAuth voltar com `?code=` fora de /auth/callback
  // (ex.: Supabase caiu na Site URL = raiz), encaminha para o handler do callback.
  const url = request.nextUrl;
  if (url.pathname !== "/auth/callback" && url.searchParams.has("code")) {
    const callback = url.clone();
    callback.pathname = "/auth/callback";
    return NextResponse.redirect(callback);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Dispara a renovação do token, se necessário.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Tudo, menos arquivos estáticos e imagens.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
