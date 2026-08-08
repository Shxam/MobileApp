import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface AnimatedValueProps {
  value: React.ReactNode;
  className?: string;
  direction?: 'up' | 'down';
}

export const AnimatedValue: React.FC<AnimatedValueProps> = ({
  value,
  className,
  direction = 'up',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const offset = direction === 'up' ? 9 : -9;

  if (shouldReduceMotion) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span className={`inline-grid overflow-hidden leading-none ${className || ''}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={String(value)}
          initial={{ y: offset, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -offset, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};
