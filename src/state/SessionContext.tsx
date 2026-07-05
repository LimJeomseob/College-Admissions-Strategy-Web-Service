import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Track } from '../types';
import { lookupMajor } from '../data/majorFamilies';

// 세션 공유 상태 — 희망학과/계열을 홈과 전략 도구가 함께 사용(라우트 간 공유).

interface SessionValue {
  desiredMajor: string;
  track: Track;
  /** 희망학과 변경(계열도 자동 추정) */
  setDesiredMajor: (v: string) => void;
  setTrack: (t: Track) => void;
}

const Ctx = createContext<SessionValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [desiredMajor, setMajor] = useState('');
  const [track, setTrack] = useState<Track>('인문');

  const setDesiredMajor = (v: string) => {
    setMajor(v);
    const lk = lookupMajor(v);
    if (lk.track) setTrack(lk.track);
  };

  const value = useMemo<SessionValue>(
    () => ({ desiredMajor, track, setDesiredMajor, setTrack }),
    [desiredMajor, track],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used within SessionProvider');
  return v;
}
