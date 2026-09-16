export type InstitutionBrand = {
  slug: string;
  names: string[];
  bgColor: string;
  textColor: string;
  label: string;
};

export const INSTITUTION_BRANDS: InstitutionBrand[] = [
  { slug: 'kb', names: ['KB국민은행', 'KB국민카드', '국민은행', '국민카드'], bgColor: '#8B734B', textColor: '#FFFFFF', label: 'KB' },
  { slug: 'shinhan', names: ['신한은행', '신한카드', '신한투자증권'], bgColor: '#0046FF', textColor: '#FFFFFF', label: '신한' },
  { slug: 'woori', names: ['우리은행', '우리카드', '우리투자증권'], bgColor: '#007BC7', textColor: '#FFFFFF', label: '우리' },
  { slug: 'hana', names: ['하나은행', '하나증권'], bgColor: '#008C8C', textColor: '#FFFFFF', label: '하나' },
  { slug: 'im', names: ['iM뱅크', '대구은행', 'IM뱅크'], bgColor: '#F37321', textColor: '#FFFFFF', label: 'iM' },
  { slug: 'kakao-bank', names: ['카카오뱅크'], bgColor: '#FFE812', textColor: '#191919', label: 'B' },
  { slug: 'kbank', names: ['케이뱅크', 'K뱅크'], bgColor: '#120064', textColor: '#FFFFFF', label: 'K' },
  { slug: 'toss', names: ['토스뱅크', '토스증권'], bgColor: '#0064FF', textColor: '#FFFFFF', label: 'T' },
  { slug: 'nh', names: ['NH농협은행', '농협은행', 'NH농협', '농협'], bgColor: '#00A04C', textColor: '#FFFFFF', label: 'NH' },
  { slug: 'ibk', names: ['IBK기업은행', '기업은행'], bgColor: '#005BAC', textColor: '#FFFFFF', label: 'IBK' },
  { slug: 'post', names: ['우체국', '우체국예금'], bgColor: '#E72511', textColor: '#FFFFFF', label: '郵' },
  { slug: 'kiwoom', names: ['키움증권'], bgColor: '#E60012', textColor: '#FFFFFF', label: '키움' },
  { slug: 'kakao-securities', names: ['카카오페이증권', '카카오증권'], bgColor: '#FFE812', textColor: '#191919', label: 'K' },
  { slug: 'samsung', names: ['삼성증권', '삼성카드'], bgColor: '#1428A0', textColor: '#FFFFFF', label: 'S' },
  { slug: 'hyundai', names: ['현대카드', '현대차증권'], bgColor: '#002C5F', textColor: '#FFFFFF', label: 'H' },
  { slug: 'lotte', names: ['롯데카드'], bgColor: '#ED1C24', textColor: '#FFFFFF', label: 'L' },
  { slug: 'mirae', names: ['미래에셋증권'], bgColor: '#F58220', textColor: '#FFFFFF', label: 'M' },
  { slug: 'nh-securities', names: ['NH투자증권', 'NH증권'], bgColor: '#00A04C', textColor: '#FFFFFF', label: 'NH' },
  { slug: 'kb-securities', names: ['KB증권'], bgColor: '#8B734B', textColor: '#FFFFFF', label: 'KB' },
  { slug: 'shinhan-securities', names: ['신한투자증권'], bgColor: '#0046FF', textColor: '#FFFFFF', label: '신한' },
  { slug: 'sc', names: ['SC제일은행'], bgColor: '#007A53', textColor: '#FFFFFF', label: 'SC' },
  { slug: 'citi', names: ['한국씨티은행', '씨티은행'], bgColor: '#003B70', textColor: '#FFFFFF', label: 'C' },
];

function normalize(name: string): string {
  return name.replace(/\s/g, '').toLowerCase();
}

export function getInstitutionBrand(institution: string | null | undefined): InstitutionBrand | null {
  if (!institution) return null;
  const normalized = normalize(institution);

  for (const brand of INSTITUTION_BRANDS) {
    for (const alias of brand.names) {
      const normalizedAlias = normalize(alias);
      if (normalized === normalizedAlias || normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized)) {
        return brand;
      }
    }
  }

  return null;
}

export function getInstitutionFallback(institution: string): InstitutionBrand {
  const trimmed = institution.trim();
  const label = trimmed.length <= 2 ? trimmed : trimmed.slice(0, 2);
  return {
    slug: 'unknown',
    names: [institution],
    bgColor: '#9CA3AF',
    textColor: '#FFFFFF',
    label,
  };
}
