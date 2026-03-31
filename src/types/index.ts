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

/** Привязка одного кода ФККО к конкретным видам работ */
export interface FkkoEntry {
  fkkoCode: string;
  wasteName?: string;
  hazardClass?: string;
  activityTypes: string[];
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
  /** Гранулярная привязка ФККО → виды работ */
  entries?: FkkoEntry[];
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
  /**
   * При загрузке с /api/license-sites:
   * `id` — это id лицензии, а `siteId` — id записи license_sites.
   */
  siteId?: number;
  siteLabel?: string | null;
  sites?: LicenseSiteData[];
  addressAliases?: Record<string, string>;
  // Поля moderation / оплаты
  status?: 'pending' | 'recheck' | 'approved' | 'rejected' | string;
  reward?: number;
  rejectionNote?: string | null;
  moderatedComment?: string | null;
  moderatedAt?: string | null;
  ownerUserId?: number | null;

  // Оригинальный PDF пользователя (для скачивания администратором)
  fileOriginalName?: string | null;
  fileStoredName?: string | null;
  /** Импорт из внешнего реестра (например rpn_registry); null — ручная загрузка */
  importSource?: string | null;
  importExternalRef?: string | null;
  importNeedsReview?: boolean;
  /** Импорт из rpn_registry: в выгрузке реестра статус не active */
  importRegistryInactive?: boolean;
  /** Установлено /api/analyze-license при переданном Bearer, если ИНН уже есть в БД */
  innAlreadyRegistered?: boolean;
  /** Точные цитаты из документа для подсветки при фокусе на поле */
  foundTexts?: LicenseDataFoundTexts;
}
