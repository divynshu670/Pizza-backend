import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
    try {
        const u = await prisma.user.findUnique({ where: { id } });
        done(null, u ?? null);
    }
    catch (err) {
        done(err, null);
    }
});
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    callbackURL: process.env.GOOGLE_CALLBACK_URL ?? "",
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = Array.isArray(profile.emails) && profile.emails.length > 0
            ? profile.emails[0]?.value ?? ""
            : "";
        const displayName = profile.displayName ?? "Unnamed";
        if (!profile.id && !email) {
            return done(new Error("Google profile did not contain id or email"));
        }
        // try find by googleId first
        let user = await prisma.user.findUnique({
            where: { googleId: profile.id ?? undefined },
        });
        // fallback: find by email
        if (!user && email) {
            user = await prisma.user.findUnique({ where: { email } });
        }
        if (!user) {
            // create user
            user = await prisma.user.create({
                data: {
                    name: displayName,
                    email,
                    googleId: profile.id,
                    hashedPassword: null,
                },
            });
        }
        else if (!user.googleId) {
            // attach googleId if exists user by email
            user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId: profile.id ?? undefined },
            });
        }
        done(null, user);
    }
    catch (err) {
        done(err);
    }
}));
export default passport;
