import React, { useState } from 'react';
import { Star, CheckCircle, ThumbsUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onReviewSubmitted: (rating: number, comment: string) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  title,
  onReviewSubmitted,
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onReviewSubmitted(rating, comment);
    onClose();
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
            className="absolute top-3 right-3 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center space-y-1">
            <span className="text-[10px] text-amber-400 font-extrabold uppercase">RATINGS & REVIEWS</span>
            <h3 className="font-extrabold text-sm text-white">{title}</h3>
            <p className="text-[11px] text-slate-400">How was your Dhaba food / Turf pitch experience?</p>
          </div>

          {/* Star Rating Picker */}
          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 transition-transform hover:scale-125"
              >
                <Star
                  className={`w-7 h-7 ${
                    star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                  }`}
                />
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Write your review feedback:</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Delicious piping hot biryani! Great floodlights on the turf pitch."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 text-slate-950 font-extrabold py-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-lg"
            >
              <ThumbsUp className="w-4 h-4" />
              <span>Submit Review</span>
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
