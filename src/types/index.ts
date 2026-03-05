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

/** Данные, извлечённые из лицензии (ответ ИИ + геокодинг) */
export interface LicenseData {
  companyName: string;
  inn: string;
  address: string;
  fkkoCodes: string[];
  lat?: number;
  lng?: number;
}
