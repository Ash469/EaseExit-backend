const GoogleStrategy = require("passport-google-oauth20").Strategy;
const passport = require("passport");
require("dotenv").config(); // make sure this is at the top
require("../models/User"); // if not already loaded

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL, // ← use the env var
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const user = await require("../models/User").findOne({ email });
        if (!user)
          return done(null, false, { message: "User not registered." });
        if (user.role === "student")
          return done(null, false, {
            message: "Students cannot log in this Portal.",
          });
        done(null, user);
      } catch (err) {
        done(err, false);
      }
    }
  )
);

module.exports = passport;
