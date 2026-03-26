import type { ComponentType } from 'react';

export interface BlogPost {
  id: number;
  title: string;
  description: string;
  image: string;
  url: string;
  width: string;
}

export interface ServiceCard {
  id: string;
  number: string;
  title: string;
  url: string;
}

export interface HelpCard {
  id: number;
  image: string;
  title: string;
  description: string;
}

export interface NavLink {
  label: string;
  href: string;
  isActive?: boolean;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface SocialLink {
  icon: ComponentType<{ className?: string }>;
  href: string;
  label: string;
}

export interface TeamMember {
  name: string;
  image: string;
}

export interface FeatureItem {
  id: number;
  text: string;
}

/** Цитаты из документа для подсветки в PDF (Double Check) */
export interface LicenseDataFoundTexts {
  companyName: string;
  inn: string;
  address: string;
  fkkoCodes: string;
}

export interface LicenseSiteData {
  id?: number;
  siteLabel?: string | null;
  address: string;
  region?: string | null;
  lat?: number | null;
  lng?: number | null;
  fkkoCodes: string[];
  activityTypes: string[];
  /** Исходное значение из таблицы (например, 'Адрес 1') */
  addressRef?: string;
}

/** Данные, извлечённые из лицензии (ответ ИИ + геокодинг) */
export interface LicenseData {
  id?: number;
  companyName: string;
  inn: string;
  region?: string;
  address: string;
  fkkoCodes: string[];
  activityTypes?: string[];
  lat?: number;
  lng?: number;
  createdAt?: string;
  sites?: LicenseSiteData[];
  addressAliases?: Record<string, string>;
  // Поля moderation / оплаты
  status?: 'pending' | 'approved' | 'rejected' | string;
  reward?: number;
  rejectionNote?: string | null;
  moderatedComment?: string | null;
  moderatedAt?: string | null;
  ownerUserId?: number | null;

  // Оригинальный PDF пользователя (для скачивания администратором)
  fileOriginalName?: string | null;
  fileStoredName?: string | null;
  /** Точные цитаты из документа для подсветки при фокусе на поле */
  foundTexts?: LicenseDataFoundTexts;
}
