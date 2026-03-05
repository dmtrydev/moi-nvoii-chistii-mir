import type { TeamMember, HelpCard, FeatureItem } from '@/types';

export const TEAM_MEMBERS: TeamMember[] = [
  { name: 'John Smith', image: '/team-member-2.png' },
  { name: 'Anna Lonsen', image: '/team-member-3.png' },
  { name: 'David Jones', image: '/team-member.png' },
  { name: 'Jane Austen', image: '/image.png' },
];

export const HELP_CARDS: HelpCard[] = [
  {
    id: 1,
    image: '/green-fields.png',
    title: 'Leading the Way in Eco-Friendly Innovation',
    description:
      'At GreenX, we are committed to pioneering solutions that reduce environmental impact and promote sustainable living. Our innovative designs and systems are at the forefront of eco-conscious development.',
  },
  {
    id: 2,
    image: '/green-fields-2.png',
    title: 'Empowering Green Choices',
    description:
      'Our mission is to inspire and empower individuals and communities to make environmentally responsible decisions. Through education and practical solutions, we enable a shift towards a greener lifestyle.',
  },
];

export const TEAM_FEATURES: FeatureItem[] = [
  { id: 1, text: 'Be part of the change' },
  { id: 2, text: 'Get involved' },
  { id: 3, text: 'Stay connected' },
  { id: 4, text: 'Act now' },
  { id: 5, text: 'Make world green' },
];
