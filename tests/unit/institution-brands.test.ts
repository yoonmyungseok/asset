import { describe, expect, it } from 'vitest';
import { getInstitutionBrand } from '@/lib/data/institution-brands';

describe('getInstitutionBrand', () => {
  it('matches known bank names', () => {
    expect(getInstitutionBrand('케이뱅크')?.slug).toBe('kbank');
    expect(getInstitutionBrand('토스뱅크')?.slug).toBe('toss');
    expect(getInstitutionBrand('카카오뱅크')?.slug).toBe('kakao-bank');
    expect(getInstitutionBrand('KB국민은행')?.slug).toBe('kb');
  });

  it('matches securities names', () => {
    expect(getInstitutionBrand('키움증권')?.slug).toBe('kiwoom');
    expect(getInstitutionBrand('토스증권')?.slug).toBe('toss');
  });

  it('returns null for empty values', () => {
    expect(getInstitutionBrand(null)).toBeNull();
    expect(getInstitutionBrand('')).toBeNull();
  });
});
