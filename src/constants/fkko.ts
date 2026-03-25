import { normalizeFkkoDigits } from '@/utils/fkko';

const FKKO_GROUP_NAMES: Record<string, string> = {
  '1': 'ОТХОДЫ СЕЛЬСКОГО, ЛЕСНОГО ХОЗЯЙСТВА, РЫБОВОДСТВА И РЫБОЛОВСТВА',
  '2': 'ОТХОДЫ ДОБЫЧИ ПОЛЕЗНЫХ ИСКОПАЕМЫХ',
  '3': 'ОТХОДЫ ОБРАБАТЫВАЮЩИХ ПРОИЗВОДСТВ',
  '4': 'ОТХОДЫ ПОТРЕБЛЕНИЯ ПРОИЗВОДСТВЕННЫЕ',
  '5': 'ОТХОДЫ КОММУНАЛЬНЫЕ, ПОДОБНЫЕ КОММУНАЛЬНЫМ',
  '6': 'ОТХОДЫ ОБЕСПЕЧЕНИЯ ЭЛЕКТРОЭНЕРГИЕЙ, ГАЗОМ И ПАРОМ',
  '7': 'ОТХОДЫ ВОДОСНАБЖЕНИЯ, ВОДООТВЕДЕНИЯ И ОЧИСТКИ',
  '8': 'ОТХОДЫ СТРОИТЕЛЬСТВА И СНОСА',
  '9': 'ОТХОДЫ ПРОЧИХ ВИДОВ ЭКОНОМИЧЕСКОЙ ДЕЯТЕЛЬНОСТИ',
};

export function getFkkoGroupName(codeLike: string): string {
  const digits = normalizeFkkoDigits(codeLike);
  const group = digits.slice(0, 1);
  return FKKO_GROUP_NAMES[group] ?? 'НАИМЕНОВАНИЕ ГРУППЫ ФККО';
}
