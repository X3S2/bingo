'use client';

import { useEffect, useState } from 'react';

interface BallAnimationProps {
  number: number;
  onDone: () => void;
}

// Many decoy balls that fly in, then immediately the final number pops
const DECOY_COUNT = 14;

function randomDecoy(exclude: number): number {
  let n: number;
  do { n = Math.floor(Math.random() * 75) + 1; } while (n === exclude);
  return n;
}

interface BallData {
  id: number;
  value: number;
  startX: string;
  startY: string;
  color: string;
  delay: number;
  size: number; // px
}

const BALL_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-lime-500',
  'bg-red-500',
  'bg-sky-500',
  'bg-emerald-500',
];

// Flying phase: 1.2s — transition immediately to final (no gap)
const FLY_DURATION = 1200;
// Final phase: 3s total
const FINAL_DURATION = 3000;
// Fade-out: 400ms
const FADE_DURATION = 400;

export function BallAnimation({ number, onDone }: BallAnimationProps) {
  const [phase, setPhase] = useState<'flying' | 'final' | 'done'>('flying');
  const [decoys] = useState<BallData[]>(() =>
    Array.from({ length: DECOY_COUNT }, (_, i) => {
      const angle = (i / DECOY_COUNT) * 2 * Math.PI + Math.random() * 0.4;
      const dist = 160 + Math.random() * 120;
      return {
        id: i,
        value: randomDecoy(number),
        startX: `${Math.cos(angle) * dist}px`,
        startY: `${Math.sin(angle) * dist}px`,
        color: BALL_COLORS[i % BALL_COLORS.length],
        // Stagger across the full fly duration so all arrive around the same time
        delay: Math.random() * 300,
        size: 44 + Math.floor(Math.random() * 24), // 44-68px
      };
    })
  );

  useEffect(() => {
    // Switch to final immediately when flying ends — no gap
    const t1 = setTimeout(() => setPhase('final'), FLY_DURATION);
    const t2 = setTimeout(() => setPhase('done'), FLY_DURATION + FINAL_DURATION);
    const t3 = setTimeout(() => onDone(), FLY_DURATION + FINAL_DURATION + FADE_DURATION);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <style>{`
        @keyframes ballFlyIn {
          0%   { opacity: 0; transform: translate(var(--bx), var(--by)) scale(0.3); }
          15%  { opacity: 1; }
          75%  { opacity: 1; transform: translate(calc(var(--bx) * 0.08), calc(var(--by) * 0.08)) scale(1.05); }
          100% { opacity: 0; transform: translate(0, 0) scale(0.5); }
        }
        @keyframes finalPop {
          0%   { opacity: 0; transform: scale(0.2); }
          45%  { opacity: 1; transform: scale(1.3); }
          65%  { transform: scale(0.92); }
          80%  { transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes finalFade {
          0%   { opacity: 1; transform: scale(1); }
          75%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.75); }
        }
        @keyframes pulseRing {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* Decoy balls flying in from all directions */}
      {phase === 'flying' && decoys.map((ball) => (
        <div
          key={ball.id}
          className={`absolute rounded-full ${ball.color} flex items-center justify-center text-white font-bold shadow-lg`}
          style={{
            width: ball.size,
            height: ball.size,
            fontSize: ball.size * 0.38,
            '--bx': ball.startX,
            '--by': ball.startY,
            animation: `ballFlyIn ${FLY_DURATION}ms ease-in-out forwards`,
            animationDelay: `${ball.delay}ms`,
          } as React.CSSProperties}
        >
          {ball.value}
        </div>
      ))}

      {/* Final ball — pops immediately after flying phase ends */}
      {phase === 'final' && (
        <>
          {/* Pulse ring behind the ball */}
          <div
            className="absolute w-36 h-36 rounded-full border-4 border-violet-400"
            style={{ animation: `pulseRing 0.7s ease-out forwards` }}
          />
          <div
            className="absolute w-36 h-36 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex flex-col items-center justify-center text-white shadow-2xl border-4 border-white/30"
            style={{
              animation: `finalPop 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards, finalFade ${FINAL_DURATION}ms 0.55s ease-in forwards`,
            }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest opacity-75 leading-none mb-1">BINGO</span>
            <span className="text-5xl font-black leading-none">{number}</span>
          </div>
        </>
      )}
    </div>
  );
}
