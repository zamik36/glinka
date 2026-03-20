import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export const BottomSheet: React.FC<Props> = ({ isOpen, onClose, children }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(15, 12, 35, 0.55)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        />
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] overflow-y-auto"
          style={{
            background: 'var(--surface-elevated)',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            boxShadow: '0 -8px 40px rgba(108, 92, 231, 0.15)',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 350 }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1.5 rounded-full" style={{ background: 'var(--accent-soft)' }} />
          </div>
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);
