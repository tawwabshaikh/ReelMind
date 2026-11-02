import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const googleCredentialsConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

export const authOptions: NextAuthOptions = {
  providers: googleCredentialsConfigured
    ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
    : [],
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ account, profile }) {
      // Only accept verified Google identities. The provider subject is the stable owner id.
      const googleProfile = profile as (typeof profile & { sub?: string; email_verified?: boolean })
      return account?.provider === 'google' && Boolean(googleProfile?.sub) && googleProfile?.email_verified === true
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub
      return session
    },
  },
  pages: { signIn: '/login' },
}
