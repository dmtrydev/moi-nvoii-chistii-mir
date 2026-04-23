import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildYandexAuthorizeUrl,
  extractYandexIdentity,
  issueOauthState,
  verifyAndConsumeOauthState,
} from './yandex.js';

test('buildYandexAuthorizeUrl builds expected query parameters', () => {
  const url = buildYandexAuthorizeUrl({
    authorizeUrl: 'https://oauth.yandex.ru/authorize',
    clientId: 'client-id',
    redirectUri: 'https://app.example.com/api/auth/yandex/callback',
    scope: 'login:email login:info',
    state: 'state123',
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://oauth.yandex.ru/authorize');
  assert.equal(parsed.searchParams.get('response_type'), 'code');
  assert.equal(parsed.searchParams.get('client_id'), 'client-id');
  assert.equal(parsed.searchParams.get('redirect_uri'), 'https://app.example.com/api/auth/yandex/callback');
  assert.equal(parsed.searchParams.get('scope'), 'login:email login:info');
  assert.equal(parsed.searchParams.get('state'), 'state123');
});

test('oauth state is issued and validated once', () => {
  let cookieValue = null;
  let clearedPath = null;
  const res = {
    cookie: (_name, value) => {
      cookieValue = value;
    },
    clearCookie: (_name, options) => {
      clearedPath = options?.path ?? null;
    },
  };
  const issued = issueOauthState(res);
  assert.equal(typeof issued, 'string');
  assert.ok(issued.length >= 32);
  assert.equal(cookieValue, issued);

  const req = { cookies: { yandex_oauth_state: issued } };
  assert.equal(verifyAndConsumeOauthState(req, res, issued), true);
  assert.equal(clearedPath, '/api/auth/yandex');
  assert.equal(verifyAndConsumeOauthState(req, res, 'invalid'), false);
});

test('extractYandexIdentity normalizes email and profile fields', () => {
  const identity = extractYandexIdentity({
    id: '987654',
    default_email: 'USER@Example.com',
    first_name: 'Иван',
    last_name: 'Петров',
    default_avatar_id: '123/abc',
  });
  assert.equal(identity.providerUserId, '987654');
  assert.equal(identity.email, 'user@example.com');
  assert.equal(identity.fullName, 'Иван Петров');
  assert.match(identity.avatarUrl ?? '', /avatars\.yandex\.net/);
});
