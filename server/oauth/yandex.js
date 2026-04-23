import crypto from 'node:crypto';

const DEFAULT_AUTHORIZE_URL = 'https://oauth.yandex.ru/authorize';
const DEFAULT_TOKEN_URL = 'https://oauth.yandex.ru/token';
const DEFAULT_INFO_URL = 'https://login.yandex.ru/info';
const OAUTH_STATE_COOKIE = 'yandex_oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function getRequiredEnv(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getYandexOauthConfig() {
  return {
    clientId: getRequiredEnv('YANDEX_CLIENT_ID'),
    clientSecret: getRequiredEnv('YANDEX_CLIENT_SECRET'),
    redirectUri: getRequiredEnv('YANDEX_REDIRECT_URI'),
    authorizeUrl: String(process.env.YANDEX_OAUTH_AUTHORIZE_URL ?? DEFAULT_AUTHORIZE_URL).trim(),
    tokenUrl: String(process.env.YANDEX_OAUTH_TOKEN_URL ?? DEFAULT_TOKEN_URL).trim(),
    infoUrl: String(process.env.YANDEX_LOGIN_INFO_URL ?? DEFAULT_INFO_URL).trim(),
    scope: String(process.env.YANDEX_OAUTH_SCOPE ?? 'login:email login:info login:avatar').trim(),
  };
}

export function buildYandexAuthorizeUrl({ authorizeUrl, clientId, redirectUri, scope, state }) {
  const url = new URL(authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  if (scope) {
    url.searchParams.set('scope', scope);
  }
  return url.toString();
}

export function issueOauthState(res) {
  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: OAUTH_STATE_TTL_MS,
    path: '/api/auth/yandex',
  });
  return state;
}

export function verifyAndConsumeOauthState(req, res, incomingState) {
  const expectedState = String(req.cookies?.[OAUTH_STATE_COOKIE] ?? '');
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth/yandex' });
  if (!expectedState || !incomingState) return false;
  if (expectedState.length !== incomingState.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expectedState), Buffer.from(incomingState));
}

export async function exchangeCodeForToken({ tokenUrl, clientId, clientSecret, redirectUri, code }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`Yandex token exchange failed with status ${response.status}`);
  }
  const payload = await response.json();
  const accessToken = String(payload?.access_token ?? '').trim();
  if (!accessToken) {
    throw new Error('Yandex token exchange returned empty access_token');
  }
  return accessToken;
}

export async function fetchYandexProfile({ infoUrl, accessToken }) {
  const profileUrl = new URL(infoUrl);
  if (!profileUrl.searchParams.has('format')) {
    profileUrl.searchParams.set('format', 'json');
  }
  const response = await fetch(profileUrl, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Yandex profile fetch failed with status ${response.status}`);
  }
  return await response.json();
}

export function extractYandexIdentity(profile) {
  const providerUserId = String(profile?.id ?? profile?.client_id ?? '').trim();
  const defaultEmail = String(profile?.default_email ?? '').trim().toLowerCase();
  const emails = Array.isArray(profile?.emails)
    ? profile.emails.map((e) => String(e ?? '').trim().toLowerCase()).filter(Boolean)
    : [];
  const email = defaultEmail || emails[0] || '';
  const firstName = String(profile?.first_name ?? '').trim();
  const lastName = String(profile?.last_name ?? '').trim();
  const fullName = `${firstName} ${lastName}`.trim() || String(profile?.real_name ?? '').trim() || String(profile?.display_name ?? '').trim() || String(profile?.login ?? '').trim();
  const avatarUrl = String(profile?.default_avatar_id ?? '').trim()
    ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
    : null;
  return {
    providerUserId,
    email,
    fullName: fullName || null,
    avatarUrl,
    rawProfile: profile,
  };
}

export function buildFrontendAuthRedirect({ ok, message }) {
  const base = String(process.env.APP_PUBLIC_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const url = new URL(ok ? `${base}/dashboard/profile` : `${base}/login`);
  if (ok) {
    url.searchParams.set('auth', 'success');
  } else {
    url.searchParams.set('auth', 'error');
    if (message) {
      url.searchParams.set('message', message);
    }
  }
  return url.toString();
}
