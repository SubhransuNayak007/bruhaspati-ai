import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export type LoaderState = 
  | 'UNDERSTANDING_QUESTION' 
  | 'ANALYZING_CONCEPT' 
  | 'SEARCHING_KNOWLEDGE' 
  | 'GENERATING_ANSWER' 
  | 'FINALIZING';

export type SubjectType = 
  | 'Physics' 
  | 'Chemistry' 
  | 'Biology' 
  | 'Mathematics' 
  | 'History' 
  | 'All';

export interface BruhaspatiLoaderProps {
  subject?: SubjectType;
  onComplete?: () => void;
  isLoading?: boolean;
}

export interface StateConfig {
  title: string;
  duration: number; // Duration in ms for this state
  progressRange: [number, number]; // [min, max] progress percentage
}

// ==========================================
// CONSTANTS & CONFIGURATIONS
// ==========================================

const STATE_CONFIGS: Record<LoaderState, StateConfig> = {
  UNDERSTANDING_QUESTION: {
    title: 'Understanding your question...',
    duration: 1800,
    progressRange: [0, 20],
  },
  ANALYZING_CONCEPT: {
    title: 'Analyzing concepts and exam patterns...',
    duration: 2200,
    progressRange: [20, 45],
  },
  SEARCHING_KNOWLEDGE: {
    title: 'Connecting NCERT, PYQs, and expert knowledge...',
    duration: 2500,
    progressRange: [45, 75],
  },
  GENERATING_ANSWER: {
    title: 'Preparing structured explanation...',
    duration: 3000,
    progressRange: [75, 95],
  },
  FINALIZING: {
    title: 'Finalizing answer...',
    duration: 1500,
    progressRange: [95, 100],
  },
};

const STATE_ORDER: LoaderState[] = [
  'UNDERSTANDING_QUESTION',
  'ANALYZING_CONCEPT',
  'SEARCHING_KNOWLEDGE',
  'GENERATING_ANSWER',
  'FINALIZING',
];

const premiumSpring = {
  type: 'spring',
  stiffness: 90,
  damping: 15,
  mass: 0.8,
};

// ==========================================
// REUSABLE HOOKS
// ==========================================

export function useBruhaspatiLoader({
  isLoading = true,
  onComplete,
}: {
  isLoading?: boolean;
  onComplete?: () => void;
}) {
  const [currentState, setCurrentState] = useState<LoaderState>('UNDERSTANDING_QUESTION');
  const [progress, setProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(11);
  const startTimeRef = useRef<number | null>(null);

  const totalDuration = useMemo(() => {
    return STATE_ORDER.reduce((acc, state) => acc + STATE_CONFIGS[state].duration, 0);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      setCurrentState('FINALIZING');
      return;
    }

    startTimeRef.current = Date.now();
    let animationFrameId: number;
    
    const updateProgress = () => {
      if (!startTimeRef.current) return;
      
      const elapsed = Date.now() - startTimeRef.current;
      
      let accumulatedTime = 0;
      let targetState = STATE_ORDER[0];
      
      for (const state of STATE_ORDER) {
        accumulatedTime += STATE_CONFIGS[state].duration;
        if (elapsed <= accumulatedTime) {
          targetState = state;
          break;
        }
        targetState = 'FINALIZING';
      }
      
      setCurrentState(targetState);
      
      const currentConfig = STATE_CONFIGS[targetState];
      const stateStartIndex = STATE_ORDER.indexOf(targetState);
      const prevAccumulatedTime = STATE_ORDER.slice(0, stateStartIndex).reduce(
        (sum, s) => sum + STATE_CONFIGS[s].duration, 
        0
      );
      
      const stateElapsed = elapsed - prevAccumulatedTime;
      const stateProgressRatio = Math.min(stateElapsed / currentConfig.duration, 1);
      
      const [minProgress, maxProgress] = currentConfig.progressRange;
      const currentProgress = minProgress + (maxProgress - minProgress) * stateProgressRatio;
      
      setProgress(Math.round(currentProgress));
      
      const remainingSecs = Math.max(0, Math.ceil((totalDuration - elapsed) / 1000));
      setEstimatedTimeRemaining(remainingSecs);

      if (elapsed >= totalDuration) {
        setProgress(100);
        setCurrentState('FINALIZING');
        if (onComplete) {
          setTimeout(onComplete, 500);
        }
      } else {
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameId = requestAnimationFrame(updateProgress);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isLoading, totalDuration, onComplete]);

  return {
    currentState,
    progress,
    estimatedTimeRemaining,
    stateConfig: STATE_CONFIGS[currentState],
  };
}

// ==========================================
// BACKGROUND PHYSICS / PARTICLE ENGINE
// ==========================================

const BackgroundParticles: React.FC<{ subject: SubjectType }> = ({ subject }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    interface Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
      alpha: number;
      angle?: number;
      angleSpeed?: number;
      radius?: number;
      type?: string;
    }

    const particles: Particle[] = [];
    const particleCount = 45;

    const getSubjectColor = () => {
      switch (subject) {
        case 'Physics': return 'rgba(79, 124, 255, '; // Electric Blue
        case 'Chemistry': return 'rgba(52, 211, 153, '; // Emerald/Mint
        case 'Biology': return 'rgba(236, 72, 153, '; // Pink/DNA
        case 'Mathematics': return 'rgba(245, 199, 106, '; // Yellow/Gold
        case 'History': return 'rgba(217, 119, 6, '; // Amber/Gold
        default: return 'rgba(79, 124, 255, '; // Electric Blue
      }
    };

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: (Math.random() - 0.5) * 0.8,
        color: getSubjectColor(),
        alpha: Math.random() * 0.4 + 0.1,
        angle: Math.random() * Math.PI * 2,
        angleSpeed: (Math.random() - 0.5) * 0.02,
        radius: Math.random() * 80 + 20,
        type: Math.random() > 0.5 ? 'molecule' : 'simple',
      });
    }

    const drawPhysicsLines = (ctx: CanvasRenderingContext2D, t: number) => {
      ctx.strokeStyle = 'rgba(79, 124, 255, 0.06)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < width; x += 15) {
        const y = height / 2 + Math.sin(x * 0.005 + t * 0.002) * 120 * Math.sin(t * 0.0005);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const drawMathGrid = (ctx: CanvasRenderingContext2D) => {
      ctx.strokeStyle = 'rgba(245, 199, 106, 0.02)';
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    };

    let time = 0;

    const render = () => {
      time++;
      ctx.clearRect(0, 0, width, height);

      const radialGlow = ctx.createRadialGradient(
        width / 2, height / 2, 20,
        width / 2, height / 2, Math.max(width, height) * 0.6
      );
      radialGlow.addColorStop(0, '#0f162f');
      radialGlow.addColorStop(0.5, '#0b0f20');
      radialGlow.addColorStop(1, '#060812');
      ctx.fillStyle = radialGlow;
      ctx.fillRect(0, 0, width, height);

      if (subject === 'Physics') drawPhysicsLines(ctx, time);
      if (subject === 'Mathematics') drawMathGrid(ctx);

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();

        if (subject === 'Chemistry' && p.type === 'molecule') {
          ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${p.alpha})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x + 15, p.y + 10, p.size * 0.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `${p.color}${p.alpha * 0.3})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 15, p.y + 10);
          ctx.stroke();
        } else if (subject === 'Biology') {
          if (p.angle !== undefined && p.angleSpeed !== undefined) {
            p.angle += p.angleSpeed;
            const helixX = p.x + Math.sin(p.angle) * 20;
            ctx.arc(helixX, p.y, p.size * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = `${p.color}${p.alpha})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.x - Math.sin(p.angle) * 20, p.y, p.size * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
            ctx.fill();
          }
        } else if (subject === 'Mathematics') {
          ctx.rect(p.x, p.y, p.size * 2, p.size * 2);
          ctx.fillStyle = `${p.color}${p.alpha})`;
          ctx.fill();
        } else if (subject === 'History') {
          ctx.rect(p.x, p.y, 1, p.size * 8);
          ctx.fillStyle = `${p.color}${p.alpha})`;
          ctx.fill();
        } else {
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${p.alpha})`;
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [subject]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
};

// ==========================================
// PETAL COMPONENT FOR 12-FOLD SYMMETRY
// ==========================================

interface PetalProps {
  angle: number;
  state: LoaderState;
  index: number;
  layer: 'inner' | 'outer';
}

const Petal: React.FC<PetalProps> = ({ angle, state, index, layer }) => {
  const isState2 = state === 'ANALYZING_CONCEPT';
  const isState3 = state === 'SEARCHING_KNOWLEDGE';
  const isState4 = state === 'GENERATING_ANSWER';
  const isState5 = state === 'FINALIZING';

  const baseDelay = index * 0.06 + (layer === 'inner' ? 0.25 : 0);
  const scale = layer === 'inner' ? 0.82 : 1.0;
  const strokeWidth = layer === 'inner' ? 1.0 : 1.4;

  return (
    <g transform={`rotate(${angle} 50 50) scale(${scale})`}>
      <motion.path
        d="M 50,50 C 36,32 38,12 50,2 C 62,12 64,32 50,50 Z"
        fill={layer === 'inner' ? 'url(#innerPetalGrad)' : 'url(#outerPetalGrad)'}
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: 1,
          opacity: isState5 ? 1 : isState4 ? 0.95 : isState3 ? 0.85 : 0.7,
        }}
        transition={{
          delay: index * 0.04,
          type: 'spring',
          stiffness: 90,
          damping: 14,
        }}
      />

      <motion.path
        d="M 50,50 C 36,32 38,12 50,2 C 62,12 64,32 50,50"
        fill="none"
        stroke="url(#goldGrad)"
        strokeWidth={strokeWidth}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: index * 0.03, duration: 1.2 }}
      />

      {layer === 'inner' && (
        <>
          <motion.path
            d="M 50,42 L 50,15"
            fill="none"
            stroke={isState5 ? '#F5C76A' : '#60A5FA'}
            strokeWidth="0.75"
            initial={{ pathLength: 0 }}
            animate={{ 
              pathLength: (isState2 || isState3 || isState4 || isState5) ? 1 : 0,
              opacity: (isState2 || isState3 || isState4 || isState5) ? 1 : 0.15
            }}
            transition={{ delay: baseDelay + 0.1, duration: 0.7 }}
          />
          <motion.circle
            cx="50"
            cy="15"
            r="0.7"
            fill={isState5 ? '#FFFFFF' : '#93C5FD'}
            initial={{ scale: 0 }}
            animate={{ scale: (isState2 || isState3 || isState4 || isState5) ? 1 : 0 }}
            transition={{ delay: baseDelay + 0.7, type: 'spring' }}
          />

          <motion.path
            d="M 50,35 L 45,28 L 45,20"
            fill="none"
            stroke={isState5 ? '#F5C76A' : '#60A5FA'}
            strokeWidth="0.75"
            initial={{ pathLength: 0 }}
            animate={{ 
              pathLength: (isState2 || isState3 || isState4 || isState5) ? 1 : 0,
              opacity: (isState2 || isState3 || isState4 || isState5) ? 1 : 0.15
            }}
            transition={{ delay: baseDelay + 0.25, duration: 0.7 }}
          />
          <motion.circle
            cx="45"
            cy="20"
            r="0.7"
            fill={isState5 ? '#FFFFFF' : '#93C5FD'}
            initial={{ scale: 0 }}
            animate={{ scale: (isState2 || isState3 || isState4 || isState5) ? 1 : 0 }}
            transition={{ delay: baseDelay + 0.85, type: 'spring' }}
          />

          <motion.path
            d="M 50,31 L 55,25 L 55,18"
            fill="none"
            stroke={isState5 ? '#F5C76A' : '#60A5FA'}
            strokeWidth="0.75"
            initial={{ pathLength: 0 }}
            animate={{ 
              pathLength: (isState2 || isState3 || isState4 || isState5) ? 1 : 0,
              opacity: (isState2 || isState3 || isState4 || isState5) ? 1 : 0.15
            }}
            transition={{ delay: baseDelay + 0.4, duration: 0.7 }}
          />
          <motion.circle
            cx="55"
            cy="18"
            r="0.7"
            fill={isState5 ? '#FFFFFF' : '#93C5FD'}
            initial={{ scale: 0 }}
            animate={{ scale: (isState2 || isState3 || isState4 || isState5) ? 1 : 0 }}
            transition={{ delay: baseDelay + 1.0, type: 'spring' }}
          />
        </>
      )}
    </g>
  );
};

// ==========================================
// LOTUS EMBLEM COMPONENT
// ==========================================

interface LotusEmblemProps {
  state: LoaderState;
  subject: SubjectType;
}

const LotusEmblem: React.FC<LotusEmblemProps> = ({ state, subject }) => {
  const outerAngles = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 30), []);
  const innerAngles = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 30 + 15), []);

  const glowColor = useMemo(() => {
    switch (subject) {
      case 'Physics': return 'rgba(79, 124, 255, 0.45)';
      case 'Chemistry': return 'rgba(52, 211, 153, 0.45)';
      case 'Biology': return 'rgba(236, 72, 153, 0.45)';
      case 'Mathematics': return 'rgba(245, 199, 106, 0.45)';
      case 'History': return 'rgba(217, 119, 6, 0.45)';
      default: return 'rgba(79, 124, 255, 0.45)';
    }
  }, [subject]);

  const showNeural = 
    state === 'SEARCHING_KNOWLEDGE' || 
    state === 'GENERATING_ANSWER' || 
    state === 'FINALIZING';

  const constellationNodes = [
    { cx: 50, cy: 37, id: 'n1' },
    { cx: 43, cy: 59, id: 'n2' },
    { cx: 57, cy: 59, id: 'n3' },
    { cx: 46, cy: 51, id: 'n4' },
    { cx: 54, cy: 51, id: 'n5' },
    { cx: 48, cy: 44, id: 'n6' },
    { cx: 52, cy: 44, id: 'n7' },
    { cx: 50, cy: 51, id: 'n8' },
    { cx: 50, cy: 59, id: 'n9' },
  ];

  const constellationLines = [
    { from: [50, 37], to: [48, 44] },
    { from: [50, 37], to: [52, 44] },
    { from: [48, 44], to: [46, 51] },
    { from: [52, 44], to: [54, 51] },
    { from: [46, 51], to: [43, 59] },
    { from: [54, 51], to: [57, 59] },
    { from: [46, 51], to: [50, 51] },
    { from: [54, 51], to: [50, 51] },
    { from: [48, 44], to: [52, 44] },
    { from: [50, 51], to: [50, 59] },
    { from: [43, 59], to: [50, 59] },
    { from: [57, 59], to: [50, 59] },
  ];

  return (
    <div className="relative w-52 h-52 flex items-center justify-center">
      <motion.div
        className="absolute w-48 h-48 rounded-full blur-3xl opacity-60 z-0 pointer-events-none"
        animate={{
          background: [
            `radial-gradient(circle, ${glowColor} 0%, rgba(11, 16, 32, 0) 70%)`,
            `radial-gradient(circle, ${glowColor} 15%, rgba(11, 16, 32, 0) 80%)`,
            `radial-gradient(circle, ${glowColor} 0%, rgba(11, 16, 32, 0) 70%)`,
          ],
          scale: [0.95, 1.12, 0.95],
        }}
        transition={{
          duration: 3.2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <AnimatePresence>
        {(state === 'UNDERSTANDING_QUESTION' || state === 'GENERATING_ANSWER' || state === 'FINALIZING') && (
          <motion.div
            className="absolute w-44 h-44 rounded-full border border-dashed z-10"
            style={{
              borderColor: state === 'FINALIZING' ? '#F5C76A' : '#4F7CFF',
              boxShadow: state === 'FINALIZING' 
                ? '0 0 20px rgba(245, 199, 106, 0.35)' 
                : '0 0 20px rgba(79, 124, 255, 0.25)',
            }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ 
              opacity: [0.3, 0.75, 0.3], 
              scale: 1, 
              rotate: 360 
            }}
            exit={{ opacity: 0, scale: 1.25 }}
            transition={{
              rotate: { duration: 12, repeat: Infinity, ease: 'linear' },
              opacity: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
              scale: premiumSpring,
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="relative w-40 h-40 z-20"
        animate={{
          rotate: state === 'ANALYZING_CONCEPT' ? 5 : state === 'FINALIZING' ? 360 : 0,
          scale: state === 'FINALIZING' ? 1.08 : 1,
        }}
        transition={premiumSpring}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_18px_rgba(79,124,255,0.45)]">
          <defs>
            <linearGradient id="outerPetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0B0F19" />
              <stop offset="50%" stopColor="#111827" />
              <stop offset="100%" stopColor="#070A12" />
            </linearGradient>

            <linearGradient id="innerPetalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E3A8A" />
              <stop offset="50%" stopColor="#1E40AF" />
              <stop offset="100%" stopColor="#111827" />
            </linearGradient>

            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5C76A" />
              <stop offset="35%" stopColor="#EAB308" />
              <stop offset="70%" stopColor="#CA8A04" />
              <stop offset="100%" stopColor="#F5C76A" />
            </linearGradient>

            <radialGradient id="glassSphereGrad" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="30%" stopColor="#2563EB" />
              <stop offset="75%" stopColor="#1E1B4B" />
              <stop offset="100%" stopColor="#030712" />
            </radialGradient>
          </defs>

          <g>
            {outerAngles.map((angle, index) => (
              <Petal key={`outer-${angle}`} angle={angle} state={state} index={index} layer="outer" />
            ))}
          </g>

          <g>
            {innerAngles.map((angle, index) => (
              <Petal key={`inner-${angle}`} angle={angle} state={state} index={index} layer="inner" />
            ))}
          </g>

          <g>
            <circle
              cx="50"
              cy="50"
              r="16.5"
              fill="url(#glassSphereGrad)"
              stroke="url(#goldGrad)"
              strokeWidth="1.25"
            />
            <path
              d="M 36.5,44.5 A 13.5,13.5 0 0 1 48,34.5 A 15.5,15.5 0 0 0 34.5,47 A 15.5,15.5 0 0 1 36.5,44.5 Z"
              fill="rgba(255, 255, 255, 0.16)"
            />
          </g>

          <g>
            {constellationLines.map((line, idx) => (
              <motion.line
                key={`line-${idx}`}
                x1={line.from[0]}
                y1={line.from[1]}
                x2={line.to[0]}
                y2={line.to[1]}
                stroke="#F5C76A"
                strokeWidth="0.8"
                opacity="0.85"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: showNeural ? 1 : 0 }}
                transition={{ delay: idx * 0.04 + 0.1, duration: 0.5 }}
              />
            ))}

            {constellationNodes.map((node, idx) => (
              <motion.circle
                key={node.id}
                cx={node.cx}
                cy={node.cy}
                r="1.2"
                fill="#F5C76A"
                stroke="#0B1020"
                strokeWidth="0.4"
                initial={{ scale: 0 }}
                animate={{ scale: showNeural ? 1 : 0 }}
                transition={{ delay: idx * 0.03 + 0.45, type: 'spring', stiffness: 140 }}
              />
            ))}
          </g>
        </svg>
      </motion.div>

      <AnimatePresence>
        {state === 'FINALIZING' && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-amber-300 pointer-events-none z-10"
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1.18, opacity: 0.85 }}
            exit={{ scale: 1.35, opacity: 0 }}
            transition={{
              duration: 1.3,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ==========================================
// MAIN REUSABLE LOADER SCREEN
// ==========================================

export const BruhaspatiLoader: React.FC<BruhaspatiLoaderProps> = ({
  subject = 'All',
  onComplete,
  isLoading = true,
}) => {
  const { currentState, progress, estimatedTimeRemaining, stateConfig } = useBruhaspatiLoader({
    isLoading,
    onComplete,
  });

  return (
    <div className="relative min-h-[520px] w-full flex flex-col items-center justify-center overflow-hidden bg-[#0B1020] text-slate-100 z-10 p-4 md:p-8 rounded-2xl border border-slate-800/60 backdrop-blur-xl">
      <BackgroundParticles subject={subject} />

      <motion.div
        className="relative w-full max-w-lg mx-auto bg-slate-950/45 border border-slate-800/80 rounded-2xl p-6 md:p-8 backdrop-blur-2xl shadow-2xl flex flex-col items-center justify-center z-10"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={premiumSpring}
      >
        <div className="flex items-center gap-2 mb-6">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
          </span>
          <span className="text-xs font-semibold tracking-widest text-blue-400/90 uppercase font-mono">
            Bruhaspati AI {subject !== 'All' ? `• ${subject}` : ''}
          </span>
        </div>

        <LotusEmblem state={currentState} subject={subject} />

        <div className="h-16 text-center mt-6 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.h3
              key={currentState}
              className="text-lg md:text-xl font-medium tracking-wide text-slate-200"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {stateConfig.title}
            </motion.h3>
          </AnimatePresence>
        </div>

        <div className="w-full mt-4">
          <div className="flex justify-between items-center text-xs text-slate-400 font-mono mb-2">
            <span>Progress</span>
            <span className="text-slate-200 font-semibold">{progress}%</span>
          </div>
          <div className="w-full h-[6px] bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: progress >= 95 
                  ? 'linear-gradient(90deg, #F5C76A 0%, #D97706 100%)' 
                  : 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
                boxShadow: progress >= 95 
                  ? '0 0 10px rgba(245, 199, 106, 0.5)' 
                  : '0 0 10px rgba(59, 130, 246, 0.5)',
              }}
              animate={{ width: `${progress}%` }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.4 }}
            />
          </div>
        </div>

        <div className="flex w-full items-center justify-between mt-6 pt-4 border-t border-slate-800/50 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5 text-blue-400">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <polyline points="12 6 12 12 16 14" strokeWidth="2" />
            </svg>
            <span>Est. Wait: <strong className="text-slate-300">{estimatedTimeRemaining}s</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>GPU Acceleration Active</span>
          </div>
        </div>
      </motion.div>

      <div className="absolute inset-0 bg-transparent bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none z-0" />
    </div>
  );
};

export default BruhaspatiLoader;
