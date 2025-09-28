import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
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
        let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
        });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    name: displayName,
                    email,
                    googleId: profile.id,
                },
            });
        }
        return done(undefined, user);
    }
    catch (err) {
        return done(err);
    }
}));
export default passport;
//# sourceMappingURL=passport.js.map