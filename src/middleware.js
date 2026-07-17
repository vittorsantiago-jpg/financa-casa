import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Middleware de autenticação — roda em TODA requisição antes do render.
 *
 * Responsabilidades:
 *  1. Renovar o token JWT automaticamente (Supabase SSR)
 *  2. Redirecionar usuários não autenticados para /auth
 *  3. Redirecionar usuários autenticados sem household para /setup
 *  4. Redirecionar usuários já logados para /dashboard se tentarem /auth
 */
export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: não adicionar código entre createServerClient e getUser()
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute  = pathname.startsWith("/auth");
  const isSetupRoute = pathname.startsWith("/setup");
  const isPublic     = isAuthRoute || pathname === "/";

  // Não autenticado → vai para /auth
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  // Já autenticado tentando acessar /auth → vai para /dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Autenticado mas sem household → vai para /setup
  if (user && !isSetupRoute && !isPublic) {
    const { data: membership } = await supabase
      .from("household_members")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.json|sw\\.js|workbox-.*\\.js).*)",
  ],
};
