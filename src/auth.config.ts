import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [],
  pages: {
    signIn: "/",
  },
  callbacks: {
    authorized({
      auth,
      request: { nextUrl },
    }: {
      auth: { user?: { email?: string | null } } | null;
      request: { nextUrl: URL };
    }): boolean | Response {
      const isLoggedIn = !!auth?.user;
      const isOnChat = nextUrl.pathname.startsWith("/chat");
      const isOnRoot = nextUrl.pathname === "/";

      if (isOnChat && !isLoggedIn) return false; // → / にリダイレクト
      if (isOnRoot && isLoggedIn) {
        return Response.redirect(new URL("/chat", nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
