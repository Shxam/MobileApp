import React, { useEffect, useState } from 'react';
import { Star, ThumbsUp, X, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** What is being rated, e.g. an order number or a turf name. */
  title: string;
  /**
   * Sends the rating. Resolving closes the modal; rejecting keeps it open with
   * the reason shown, because the server refuses duplicates and un-delivered
   * orders and the customer needs to be told which.
   */
  onSubmit: (rating: number, comment: string) => Promise<void>;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, title, onSubmit }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh form per target: without this, reopening the modal for a different
  // order shows the previous order's stars and text.
  useEffect(() => {
    if (isOpen) {
      setRating(5);
      setComment('');
      setError(null);
    }
  }, [isOpen, title]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(rating, comment.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The review could not be submitted.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white space-y-4 shadow-2xl relative"
        >
          <button
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close review"
            className="absolute top-3 right-3 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center space-y-1">
            <span className="text-[10px] text-amber-400 font-extrabold uppercase">Ratings &amp; reviews</span>
            <h3 className="font-extrabold text-sm text-white">{title}</h3>
            <p className="text-[11px] text-slate-400">How was it?</p>
          </div>

          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                disabled={isSubmitting}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
                aria-pressed={star === rating}
                className="p-1 transition-transform hover:scale-125 disabled:hover:scale-100"
              >
                <Star
                  className={`w-7 h-7 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`}
                />
              </button>
            ))}
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 text-xs">
            <div>
              <label htmlFor="review-comment" className="block text-slate-300 font-semibold mb-1">
                Write your feedback
              </label>
              <textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                disabled={isSubmitting}
                placeholder="Piping hot biryani, and the floodlights were spot on."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="text-[11px] font-bold text-rose-300 bg-rose-950/50 rounded-xl px-3 py-2 flex items-start gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || comment.trim().length === 0}
              className="w-full bg-amber-500 text-slate-950 font-extrabold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <ThumbsUp className="w-4 h-4" />
                  <span>Submit review</span>
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
