import { getInstitutionBrand, getInstitutionFallback } from '@/lib/data/institution-brands';

interface Props {
  institution: string | null | undefined;
  size?: number;
  className?: string;
}

export default function InstitutionIcon({ institution, size = 32, className = '' }: Props) {
  if (!institution) return null;

  const brand = getInstitutionBrand(institution) ?? getInstitutionFallback(institution);
  const fontSize = brand.label.length > 2 ? size * 0.32 : size * 0.4;

  return (
    <span
      className={`institution-icon ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: brand.bgColor,
        color: brand.textColor,
        fontSize,
      }}
      title={institution}
      aria-hidden
    >
      {brand.label}
    </span>
  );
}
