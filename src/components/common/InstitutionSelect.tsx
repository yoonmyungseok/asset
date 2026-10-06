'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { InstitutionGroup } from '@/types/api';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function InstitutionSelect({
  value,
  onChange,
  placeholder = '선택',
  className = '',
}: Props) {
  const [groups, setGroups] = useState<InstitutionGroup[]>([]);

  useEffect(() => {
    api.getInstitutions().then(setGroups).catch(() => setGroups([]));
  }, []);

  const known = groups.flatMap((g) => g.institutions);
  const showCustom = value && !known.includes(value);

  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={
          className ||
          'flex h-12 w-full appearance-none items-center rounded-xl border border-gray-200 bg-white px-3.5 pr-9 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer'
        }
      >
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
      <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-gray-400">
        ▼
      </div>
    </div>
  );
}
