import { createContext } from 'react';

export interface AuthUser {
  id: number;
  email: string;
  fullName?: string;
  avatarUrl?: string | null;
  role: 'USER' | 'MODERATOR' | 'SUPERADMIN';
}

export interface AuthContextValue {
  user: AuthUser | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<AuthUser | { requiresTwoFactor: true; challengeToken: string }>;
  loginWithTwoFactor: (challengeToken: string, options: { totpCode?: string; recoveryCode?: string }) => Promise<AuthUser>;
  requestRegistrationCode: (email: string, password: string, fullName: string) => Promise<void>;
  confirmRegistration: (email: string, code: string) => Promise<AuthUser>;
  getSecurityOverview: () => Promise<{
    twoFactorEnabled: boolean;
    trustedDeviceDays: number;
    primaryLoginMethod: 'PASSWORD' | 'PASSWORD_TOTP';
    allowImageLogin: boolean;
    allowMessengerLogin: boolean;
    allowQrLogin: boolean;
    sessions: Array<{ id: string; userAgent?: string; ipAddress?: string; createdAt: string; expiresAt: string; revokedAt?: string | null }>;
    events: Array<{ action: string; severity: string; createdAt: string; metadata?: Record<string, unknown> }>;
  }>;
  updateSecuritySettings: (payload: {
    primaryLoginMethod?: 'PASSWORD' | 'PASSWORD_TOTP';
    allowImageLogin?: boolean;
    allowMessengerLogin?: boolean;
    allowQrLogin?: boolean;
  }) => Promise<void>;
  requestSecurePasswordChange: (oldPassword: string, newPassword: string) => Promise<void>;
  confirmSecurePasswordChange: (code: string) => Promise<void>;
  setupTwoFactor: () => Promise<{ secret: string; otpauthUrl: string }>;
  enableTwoFactor: (totpCode: string) => Promise<{ recoveryCodes: string[] }>;
  disableTwoFactor: (options: { totpCode?: string; recoveryCode?: string }) => Promise<void>;
  regenerateRecoveryCodes: () => Promise<{ recoveryCodes: string[] }>;
  revokeSession: (sessionId: string) => Promise<void>;
  revokeAllOtherSessions: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

