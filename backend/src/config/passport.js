const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const jwt = require('jsonwebtoken');

const githubClientID = process.env.GITHUB_CLIENT_ID || '';
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || '';
const githubCallbackURL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/auth/github/callback';

console.log('DEBUG: GITHUB_CLIENT_ID:', githubClientID ? 'set' : 'undefined');
console.log('DEBUG: GITHUB_CLIENT_SECRET:', githubClientSecret ? 'set' : 'undefined');
console.log('DEBUG: GITHUB_CALLBACK_URL:', githubCallbackURL);

if (!githubClientID || !githubClientSecret) {
  console.warn('GitHub OAuth credentials are missing. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET. Github authentication routes will be disabled.');
} else {
  passport.use(
    new GitHubStrategy(
      {
        clientID: githubClientID,
        clientSecret: githubClientSecret,
        callbackURL: githubCallbackURL,
        scope: ['user:email'],
        customHeaders: {},
        authorizationURL: 'https://github.com/login/oauth/authorize',
        tokenURL: 'https://github.com/login/oauth/access_token',
        customParameters: { prompt: 'consent' },
      },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const db = require('../config/database');
        
        let user = await db.query(
          'SELECT * FROM users WHERE github_id = $1',
          [profile.id]
        );

        if (user.rows.length === 0) {
          const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
          
        const newUser = await db.query(
            `INSERT INTO users (github_id, username, email, avatar_url, github_profile_url, role)
             VALUES ($1, $2, $3, $4, $5, 'freelancer')
             RETURNING *`,
            [
              profile.id,
              profile.username,
              email,
              profile.photos?.[0]?.value,
              profile.profileUrl
            ]
          );
          user = newUser;
          console.log('User inserted:', user.rows[0]);
        }

        const token = jwt.sign(
          { userId: user.rows[0].id, role: user.rows[0].role },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );

        done(null, { user: user.rows[0], token });
      } catch (error) {
        done(error, null);
      }
    }
  )
);
}

module.exports = passport;