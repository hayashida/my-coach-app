import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth.config";
import { checkAllowedEmail } from "@/lib/allow-list";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [Google],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }): Promise<boolean> {
      if (account?.provider !== "google") return false;
      if (!profile?.email_verified) return false;

      const allowedEmails =
        process.env.ALLOWED_EMAILS?.split(",").map((e) => e.trim()) ?? [];

      return checkAllowedEmail(user.email ?? "", allowedEmails);
    },
  },
});
