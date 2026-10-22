import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { adminDb } from "@/lib/firebase-admin";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      const userRef = adminDb.collection("users").doc(user.email);
      const existing = await userRef.get();

      if (!existing.exists) {
        // First time seeing this email — default to patient.
        // Doctor/admin roles are only ever set by the backend/admin panel,
        // never overwritten here.
        await userRef.set({
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
          role: "patient",
          createdAt: new Date().toISOString(),
        });
      } else {
        // Just refresh name/image, never touch role.
        await userRef.set(
          { name: user.name ?? null, image: user.image ?? null },
          { merge: true }
        );
      }

      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const userDoc = await adminDb
          .collection("users")
          .doc(session.user.email)
          .get();
        (session.user as any).role = userDoc.exists ? userDoc.data()?.role : "patient";
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };