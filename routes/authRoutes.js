const express  = require('express');
const passport = require('passport');
const { callbackHandler, verifyGoogleUser } = require('../controllers/authController');
const User = require('../models/User'); 
const FcmToken = require('../models/FcmToken'); 
const fs = require('fs');
const appleSignin = require('apple-signin-auth');
const iosUser = require('../models/iosUser'); 
const router   = express.Router();
const jwt = require('jsonwebtoken');

// kick off OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile','email'] })
);

// handle the callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/login`      // back to React’s /login on failure
  }),
  callbackHandler                  // on success, your JWT + redirect logic
);

// Verify Google user by email and role
router.post('/verify-google-user', verifyGoogleUser);

// Register FCM token
router.post('/fcm/register', async (req, res) => {
  try {
    const { token, email, name, role, deviceType, deviceId, userId, gender } = req.body;
    if (!token || !email || !role || !userId) {
      return res.status(400).json({ success: false, message: 'token, email, role, and userId are required' });
    }
    // Upsert token (update if exists, insert if not)
    await FcmToken.findOneAndUpdate(
      { token },
      { token, email, name, role, deviceType, deviceId, userId, gender },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'FCM token registered' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete FCM token
router.delete('/fcm/delete', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'token is required' });
    }
    await FcmToken.deleteOne({ token });
    res.json({ success: true, message: 'FCM token deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Handle iOS registration
router.post('/ios', async (req, res) => {
    try {
        const { authorization, user } = req.body;

        if (!authorization || !authorization.id_token) {
            return res.status(400).json({ message: 'Authorization token from Apple is missing.' });
        }

        const decodedToken = await appleSignin.verifyIdToken(authorization.id_token, {
            audience: process.env.APPLE_CLIENT_ID,
            ignoreExpiration: true,
        });

        const appleUserId = decodedToken.sub;
        const emailFromToken = decodedToken.email;

        console.log("Decoded Apple User ID:", appleUserId);

        let existingUser = await iosUser.findOne({ appleUserId });

        if (existingUser) {
            const payload = { id: existingUser._id, role: 'iosUser' };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
            return res.status(200).json({ token, user: existingUser });
        }

        // New user – require at least some user details
        const firstName = user?.name?.firstName || 'Apple';
        const lastName = user?.name?.lastName || 'User';
        const email = user?.email || emailFromToken;

        if (!email) {
            return res.status(400).json({ message: 'Email is required for registration.' });
        }

        const newUser = new iosUser({
            appleUserId,
            email,
            name: `${firstName} ${lastName}`,
        });

        await newUser.save();

        const payload = { id: newUser._id, role: 'iosUser' };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        return res.status(201).json({ token, user: newUser });

    } catch (error) {
        console.error('Apple Sign-In Backend Error:', error);
        res.status(500).json({ message: 'An error occurred during Apple sign-in.' });
    }
});

module.exports = router;
