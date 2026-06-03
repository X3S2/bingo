'use client';

import { useEffect, useState } from 'react';

interface BallAnimationProps {
  number: number;
  onDone: () => void;
}

// Six "decoy" balls with random numbers that fly in, then converge to final number
const DECOY_COUNT = 5;

function randomDecoy(exclude: number): number {
  let n: number;
  do { n = Math.floor(Math.random() * 75) + 1; } while (n === exclude);
  return n;
}

interface BallData {
  id: number;
  value: number;
  // CSS keyframe offsets as inline-style strings (varies per ball for variety)
  startX: string;
  startY: string;
  color: string;
}

const BALL_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-rose-500',
];

export function BallAnimation({ number, onDone }: BallAnimationProps) {
  const [phase, setPhase] = useState<'flying' | 'final' | 'done'>('flying');
  const [decoys] = useState<BallData[]>(() =>
    Array.from({ length: DECOY_COUNT }, (_, i) => ({
      id: i,
      value: randomDecoy(number),
      startX: `${(Math.random() - 0.5) * 200}px`,
      startY: `${(Math.random() - 0.5) * 200}px`,
      color: BALL_COLORS[i % BALL_COLORS.length],
    }))
  );

  useEffect(() => {
    // Phase 1: flying balls (1.4s)
    const t1 = setTimeout(() => setPhase('final'), 1400);
    // Phase 2: show final number (2.5s)
    const t2 = setTimeout(() => setPhase('done'), 1400 + 2500);
    // Phase 3: unmount
    const t3 = setTimeout(() => onDone(), 1400 + 2500 + 500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <style>{`
        @keyframes ballFly {
          0%   { opacity: 0; transform: translate(var(--bx), var(--by)) scale(0.4); }
          20%  { opacity: 1; }
          80%  { opacity: 1; transform: translate(calc(var(--bx) * 0.15), calc(var(--by) * 0.15)) scale(1); }
          100% { opacity: 0; transform: translate(0, 0) scale(0.6); }
        }
        @keyframes finalPop {
          0%   { opacity: 0; transform: scale(0.3); }
          40%  { opacity: 1; transform: scale(1.25); }
          60%  { transform: scale(0.95); }
          75%  { transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes finalFade {
          0%   { opacity: 1; transform: scale(1); }
          80%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.7); }
        }
      `}</style>

      {/* Decoy balls flying in */}
      {phase === 'flying' && decoys.map((ball) => (
        <div
          key={ball.id}
          className={`absolute w-16 h-16 rounded-full ${ball.color} flex items-center justify-center text-white font-bold text-xl shadow-lg`}
          style={{
            '--bx': ball.startX,
            '--by': ball.startY,
            animation: 'ballFly 1.4s ease-in-out forwards',
            animationDelay: `${ball.id * 60}ms`,
          } as React.CSSProperties}
        >
          {ball.value}
        </div>
      ))}

      {/* Final ball with the actual drawn number */}
      {phase === 'final' && (
        <div
          className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex flex-col items-center justify-center text-white shadow-2xl border-4 border-white/30"
          style={{ animation: 'finalPop 0.6s cubic-bezier(0.175,0.885,0.32,1.275) forwards, finalFade 2.5s 0.6s ease-in forwards' }}
        >
          <span className="text-xs font-semibold uppercase tracking-widest opacity-75">BINGO</span>
          <span className="text-5xl font-black leading-none">{number}</span>
        </div>
      )}
    </div>
  );
}
