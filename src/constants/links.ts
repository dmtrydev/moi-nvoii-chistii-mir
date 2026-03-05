import type { NavLink, FooterLink } from '@/types';

export const NAV_LINKS: NavLink[] = [
  { label: 'Главная', href: 'https://greenx-template.framer.website/', isActive: true },
  { label: 'О нас', href: 'https://greenx-template.framer.website/about-us', isActive: false },
  { label: 'Услуги', href: 'https://greenx-template.framer.website/services', isActive: false },
  { label: 'Контакты', href: 'https://greenx-template.framer.website/contact-us', isActive: false },
];

export const COMPANY_LINKS: FooterLink[] = [
  { label: 'Home', href: 'https://greenx-template.framer.website/' },
  { label: 'About Us', href: 'https://greenx-template.framer.website/about-us' },
  { label: 'Our Clients', href: 'https://greenx-template.framer.website/our-clients' },
];

export const USEFUL_INFO_LINKS: FooterLink[] = [
  { label: 'Our Team', href: 'https://greenx-template.framer.website/our-team' },
  { label: 'Pricing', href: 'https://greenx-template.framer.website/pricing' },
  { label: 'Contact Us', href: 'https://greenx-template.framer.website/contact-us' },
];

export const SERVICES_LINKS: FooterLink[] = [
  {
    label: 'Recycling Systems',
    href: 'https://greenx-template.framer.website/services/new-recycling-systems',
  },
  {
    label: 'Ideas Wind Industry',
    href: 'https://greenx-template.framer.website/services/solutions-wind-industry',
  },
  {
    label: 'Green Roofs & Walls',
    href: 'https://greenx-template.framer.website/services/green-roofs-and-walls',
  },
];

export const EXTERNAL_BASE_URL = 'https://greenx-template.framer.website';
