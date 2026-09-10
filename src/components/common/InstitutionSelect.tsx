'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { InstitutionGroup } from '@/types/api';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function InstitutionSelect({ value, onChange, placeholder = '선택' }: Props) {
  const [groups, setGroups] = useState<InstitutionGroup[]>([]);

  useEffect(() => {
    api.getInstitutions().then(setGroups).catch(() => setGroups([]));
  }, []);

  const known = groups.flatMap((g) => g.institutions);
  const showCustom = value && !known.includes(value);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {showCustom && <option value={value}>{value}</option>}
      {groups.map((group) => (
        <optgroup key={group.category} label={group.label}>
          {group.institutions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
