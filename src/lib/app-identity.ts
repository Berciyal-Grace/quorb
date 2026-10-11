import { useEffect, useState } from 'react';
import { getName } from '@tauri-apps/api/app';

/** Display the installed product identity, not a user-switchable update channel. */
export function useAppName(): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getName().then(value => { if (alive) setName(value); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return name;
}

/** Unknown identity must not advertise the stable folder as a Dev default. */
export function ownedHomeDir(name: string | null): string {
  return name === 'Quorb Dev' ? '.quorb-dev' : name === 'Quorb' ? '.quorb' : '…';
}
