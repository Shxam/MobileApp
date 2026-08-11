/**
 * Every rate and fee the server charges, in one place.
 *
 * Ported from the frontend `src/services/pricingEngine.ts`, which used to be the
 * only implementation — meaning the browser decided the bill. These values are
 * now authoritative and the client's copy is display-only.
 *
 * All money is an integer count of paise (₹1 = 100 paise).
 */

/** GST on prepared food: 5%. */
export const FOOD_GST_RATE = 5;

/** GST on turf/venue services: 18%. */
export const TURF_GST_RATE = 18;

/** ₹30 to carry an order out to a turf-side bench. */
export const BENCH_DELIVERY_FEE_PAISE = 30_00;

/** ₹45 for delivery to a street address. */
export const HOME_DELIVERY_FEE_PAISE = 45_00;

/** ₹100 floodlight operating surcharge on night slots. */
export const FLOODLIGHT_SURCHARGE_PAISE = 100_00;

/** ₹150 per turf booking add-on. */
export const TURF_ADDON_FEE_PAISE = 150_00;

// ─── Celebration add-ons ────────────────────────────
//
// These were literals inside `CelebrationsView.tsx`'s `calculateTotal`, which
// means the browser priced its own party. They are authoritative here now and
// the view's arithmetic is display-only.

/** Party head count included in the base package price. */
export const CELEBRATION_INCLUDED_GUESTS = 15;

/** ₹200 per guest beyond the included head count. */
export const CELEBRATION_EXTRA_GUEST_PAISE = 200_00;

/** ₹800 for the live DJ/commentary rig. */
export const CELEBRATION_COMMENTARY_PAISE = 800_00;

/** ₹1,200 for the winner's trophy and medals. */
export const CELEBRATION_TROPHY_PAISE = 1200_00;

/** ₹1,500 for unlimited starters and drinks. */
export const CELEBRATION_FOOD_MENU_PAISE = 1500_00;

/** ₹400 per kilogram of themed cake. */
export const CELEBRATION_CAKE_PER_KG_PAISE = 400_00;

/** Bounds on a party booking, so a padded request cannot price a stadium. */
export const CELEBRATION_MIN_GUESTS = 5;
export const CELEBRATION_MAX_GUESTS = 500;
export const CELEBRATION_MAX_CAKE_KG = 20;

/** How long a quote is honoured before the client must re-quote. */
export const QUOTE_TTL_SECONDS = 10 * 60;

/** Guards against a client sending an absurd quantity. */
export const MAX_LINE_QUANTITY = 20;

/** Guards against a single request pricing an unbounded cart. */
export const MAX_CART_LINES = 50;

/**
 * Applies a GST percentage to a paise amount, rounding half-up to the paise.
 *
 * Kept as a function rather than inline arithmetic so that every tax figure in
 * the system rounds identically — a mismatch of one paise between the quote and
 * the charge is enough for Razorpay to reject a capture.
 */
export function applyGst(amountPaise: number, ratePercent: number): number {
  return Math.round((amountPaise * ratePercent) / 100);
}
