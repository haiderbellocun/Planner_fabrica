import express, { type RequestHandler } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import rateLimit from 'express-rate-limit';
import {
  login,
  register,
  getCurrentUser,
  logout,
  googleCallback,
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { env } from '../config/env.js';

const router = express.Router();

function getFrontendOrigin(): string {
  const raw =
    env.FRONTEND_URL || env.CORS_ORIGIN.split(',')[0]?.trim() || 'http://localhost:8080';
  return raw.replace(/\/$/, '');
}

const googleCallbackURL =
  env.GOOGLE_CALLBACK_URL?.trim() ||
  `http://localhost:${env.PORT}/api/auth/google/callback`;

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: googleCallbackURL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          await googleCallback(profile, done);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: unknown, done) => {
    done(null, user as never);
  });

  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
  );

  router.get('/google/callback', (req, res, next) => {
    const frontendOrigin = getFrontendOrigin();

    passport.authenticate(
      'google',
      { session: false },
      (err: Error | null | undefined, user: { token: string } | false | undefined | null) => {
if (err || !user) {
          const msg = err instanceof Error ? err.message : '';
          const errorCode =
            msg === 'USER_NOT_FOUND'
              ? 'not_found'
              : msg === 'ACCOUNT_DISABLED'
                ? 'disabled'
                : msg === 'NO_PROFILE'
                  ? 'not_found'
                  : 'error';
          return res.redirect(`${frontendOrigin}#/auth?google_error=${errorCode}`);
        }
        return res.redirect(
          `${frontendOrigin}#/auth/google/success?token=${encodeURIComponent(user.token)}`
        );
      }
    )(req, res, next);
  });
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión, inténtalo de nuevo más tarde.' },
});

router.post('/login', loginLimiter, login as RequestHandler);
router.post('/register', register as RequestHandler);
router.get('/me', authMiddleware as unknown as RequestHandler, getCurrentUser as RequestHandler);
router.post(
  '/logout',
  authMiddleware as unknown as RequestHandler,
  logout as RequestHandler
);

export default router;
