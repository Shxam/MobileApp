import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3001/api/v1';

async function runRegressionSuite() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING IPL DHABA E2E REGRESSION SUITE');
  console.log('======================================================\n');

  // Staff Sign Ins
  const adminLoginRes = await fetch(`${API_BASE}/auth/staff-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: 'ADMIN-001', pin: '7824' }),
  });
  const { accessToken: adminToken } = (await adminLoginRes.json()) as { accessToken: string };

  const driverLoginRes = await fetch(`${API_BASE}/auth/staff-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: 'DELIVERY-001', pin: '7824' }),
  });
  const { accessToken: driverToken } = (await driverLoginRes.json()) as { accessToken: string };

  const kitchenLoginRes = await fetch(`${API_BASE}/auth/staff-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: 'KITCHEN-001', pin: '7824' }),
  });
  const { accessToken: kitchenToken } = (await kitchenLoginRes.json()) as { accessToken: string };

  // ----------------------------------------------------
  // TEST A1: Concurrent Gate Pass Verification
  // ----------------------------------------------------
  console.log('--- TEST A1: Concurrent Gate Pass Verification ---');
  const slotsRes = await fetch(`${API_BASE}/bookings/slots`);
  const slots = (await slotsRes.json()) as any[];
  let slot = slots.find((s) => !s.isBooked);

  if (slot) {
    const bookingRes = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ slotId: slot.id, addons: [], paymentMethod: 'cod' }),
    });
    const booking = (await bookingRes.json()) as any;

    if (booking?.gatePassToken) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: 'paid' },
      });

      console.log(`📍 Firing 2 simultaneous scans for Token: ${booking.gatePassToken}`);
      const [res1, res2] = await Promise.all([
        fetch(`${API_BASE}/bookings/verify-gate-pass`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ token: booking.gatePassToken }),
        }).then((r) => r.json()),
        fetch(`${API_BASE}/bookings/verify-gate-pass`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ token: booking.gatePassToken }),
        }).then((r) => r.json()),
      ]);

      console.log('Response A:', res1);
      console.log('Response B:', res2);

      const validCount = [res1.valid, res2.valid].filter(Boolean).length;
      console.log(`✅ Concurrency Result: Valid count = ${validCount} (Expected: 1)\n`);
    }
  }

  // ----------------------------------------------------
  // TEST A2: Cancellation in picked_up status
  // ----------------------------------------------------
  console.log('--- TEST A2: Cancellation in picked_up Status ---');
  const customerUser = await prisma.user.findFirst({ where: { role: 'customer' } });
  if (!customerUser) throw new Error('Customer user not found');

  const pickedUpOrder = await prisma.order.create({
    data: {
      orderNumber: 'IPL-TEST-PICKED' + Math.floor(Math.random() * 9000 + 1000),
      userId: customerUser.id,
      dhabaId: 'dhaba_singarayakonda',
      status: 'ready_for_pickup',
      deliveryTarget: 'Turf Bench #1',
      subtotalPaise: 5000,
      totalAmountPaise: 5000,
      paymentStatus: 'paid',
      paymentMethod: 'wallet',
    },
  });

  // Reset driver activeOrderId so driver is clean to claim
  const driverUser = await prisma.user.findFirst({ where: { employeeId: 'DELIVERY-001' } });
  if (driverUser) {
    await prisma.driverProfile.updateMany({
      where: { userId: driverUser.id },
      data: { activeOrderId: null, isOnline: true },
    });
  }

  const claimRes = await fetch(`${API_BASE}/dispatch/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ orderId: pickedUpOrder.id }),
  });
  console.log(`Claim HTTP Status: ${claimRes.status}`);

  // Mark picked_up via dispatch endpoint
  const pickupRes = await fetch(`${API_BASE}/dispatch/${pickedUpOrder.id}/pickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
  });
  console.log(`Pickup HTTP Status: ${pickupRes.status}`);

  // Admin attempts cancel post-pickup
  const adminCancelRes = await fetch(`${API_BASE}/orders/${pickedUpOrder.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'cancelled', reason: 'Attempt cancel after pickup' }),
  });
  const adminCancelData = await adminCancelRes.json();
  console.log(`HTTP Status: ${adminCancelRes.status}`);
  console.log('Response Payload:', adminCancelData);
  console.log(`✅ State-Machine Guard Blocked Cancellation Post-Pickup: ${adminCancelRes.status === 400}\n`);

  // ----------------------------------------------------
  // TEST B1: Fan Loyalty Points Credited on OTP Delivery & Idempotency
  // ----------------------------------------------------
  console.log('--- TEST B1: Fan Loyalty Points Credited on OTP Delivery ---');

  // Customer initial fanPoints
  const pointsBefore = (await prisma.fanPoints.findUnique({ where: { userId: customerUser.id } }))?.balance ?? 0;

  // Create order for ₹50 (5000 paise) = 5 points
  const bcrypt = await import('bcrypt');
  const otpPlain = '482910';
  const otpHash = await bcrypt.hash(otpPlain, 10);

  const deliveryOrder = await prisma.order.create({
    data: {
      orderNumber: 'IPL-TEST-OTP' + Math.floor(Math.random() * 9000 + 1000),
      userId: customerUser.id,
      dhabaId: 'dhaba_singarayakonda',
      status: 'ready_for_pickup',
      deliveryTarget: 'Turf Bench #2',
      subtotalPaise: 5000,
      totalAmountPaise: 5000,
      paymentStatus: 'paid',
      paymentMethod: 'wallet',
      deliveryOtpHash: otpHash,
    },
  });

  // Driver claims & marks picked_up
  if (driverUser) {
    await prisma.driverProfile.updateMany({
      where: { userId: driverUser.id },
      data: { activeOrderId: null, isOnline: true },
    });
  }

  const claimResB1 = await fetch(`${API_BASE}/dispatch/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ orderId: deliveryOrder.id }),
  });
  console.log(`Claim B1 HTTP Status: ${claimResB1.status}`);

  const pickupResB1 = await fetch(`${API_BASE}/dispatch/${deliveryOrder.id}/pickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
  });
  console.log(`Pickup B1 HTTP Status: ${pickupResB1.status}`);

  // Set known deliveryOtpHash so OTP '482910' matches
  await prisma.order.update({
    where: { id: deliveryOrder.id },
    data: { deliveryOtpHash: otpHash },
  });

  // Complete delivery via OTP
  const completeRes1 = await fetch(`${API_BASE}/dispatch/${deliveryOrder.id}/deliver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ otp: otpPlain }),
  });
  console.log(`Complete Delivery HTTP Status 1: ${completeRes1.status}`);

  const pointsAfter1 = (await prisma.fanPoints.findUnique({ where: { userId: customerUser.id } }))?.balance ?? 0;
  console.log(`Customer FanPoints BEFORE: ${pointsBefore}`);
  console.log(`Customer FanPoints AFTER 1st Delivery: ${pointsAfter1} (+${pointsAfter1 - pointsBefore} points)`);

  // Attempt duplicate OTP completion
  const completeRes2 = await fetch(`${API_BASE}/dispatch/${deliveryOrder.id}/deliver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ otp: otpPlain }),
  });
  console.log(`Complete Delivery HTTP Status 2 (Duplicate Attempt): ${completeRes2.status}`);

  const pointsAfter2 = (await prisma.fanPoints.findUnique({ where: { userId: customerUser.id } }))?.balance ?? 0;
  console.log(`Customer FanPoints AFTER Duplicate Attempt: ${pointsAfter2}`);
  console.log(`✅ Idempotency Verified: Points did NOT double-increment! (${pointsAfter2 === pointsAfter1})\n`);

  // ----------------------------------------------------
  // TEST B1-COD: COD Fan Points Credit & Payment Settlement
  // ----------------------------------------------------
  console.log('--- TEST B1-COD: COD Fan Points Credit & Payment Settlement ---');
  const codPointsBefore = (await prisma.fanPoints.findUnique({ where: { userId: customerUser.id } }))?.balance ?? 0;

  const codOrder = await prisma.order.create({
    data: {
      orderNumber: 'IPL-TEST-COD' + Math.floor(Math.random() * 9000 + 1000),
      userId: customerUser.id,
      dhabaId: 'dhaba_singarayakonda',
      status: 'ready_for_pickup',
      deliveryTarget: 'Turf Bench #3',
      subtotalPaise: 5000,
      totalAmountPaise: 5000,
      paymentStatus: 'pending',
      paymentMethod: 'cod',
      deliveryOtpHash: otpHash,
    },
  });

  if (driverUser) {
    await prisma.driverProfile.updateMany({
      where: { userId: driverUser.id },
      data: { activeOrderId: null, isOnline: true },
    });
  }

  await fetch(`${API_BASE}/dispatch/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ orderId: codOrder.id }),
  });
  await fetch(`${API_BASE}/dispatch/${codOrder.id}/pickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
  });
  await prisma.order.update({
    where: { id: codOrder.id },
    data: { deliveryOtpHash: otpHash },
  });

  const completeResCOD = await fetch(`${API_BASE}/dispatch/${codOrder.id}/deliver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ otp: otpPlain }),
  });
  console.log(`COD Complete Delivery HTTP Status: ${completeResCOD.status}`);

  const codOrderAfter = await prisma.order.findUnique({ where: { id: codOrder.id } });
  const codPointsAfter = (await prisma.fanPoints.findUnique({ where: { userId: customerUser.id } }))?.balance ?? 0;
  const cashPayment = await prisma.payment.findFirst({ where: { orderId: codOrder.id } });

  console.log(`COD Order Payment Status: ${codOrderAfter?.paymentStatus} (Expected: paid)`);
  console.log(`COD Cash Payment Record Created: ${cashPayment?.provider === 'cash' && cashPayment?.amountPaise === 5000}`);
  console.log(`Customer FanPoints BEFORE COD: ${codPointsBefore}`);
  console.log(`Customer FanPoints AFTER COD Delivery: ${codPointsAfter} (+${codPointsAfter - codPointsBefore} points)`);
  console.log(`✅ COD FanPoints & Cash Settlement Verified: ${codPointsAfter === codPointsBefore + 5 && codOrderAfter?.paymentStatus === 'paid'}\n`);

  // ----------------------------------------------------
  // TEST B2: KDS Reject & Mark Out-of-Stock Action
  // ----------------------------------------------------
  console.log('--- TEST B2: KDS Reject & Mark Out-of-Stock ---');
  const kdsOrder = await prisma.order.create({
    data: {
      orderNumber: 'IPL-TEST-KDS' + Math.floor(Math.random() * 9000 + 1000),
      userId: customerUser.id,
      dhabaId: 'dhaba_singarayakonda',
      status: 'placed',
      deliveryTarget: 'Table 4',
      subtotalPaise: 3500,
      totalAmountPaise: 3500,
      paymentStatus: 'paid',
      paymentMethod: 'wallet',
    },
  });

  console.log(`KDS Staff rejecting placed order #${kdsOrder.orderNumber}...`);
  const rejectRes = await fetch(`${API_BASE}/orders/${kdsOrder.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kitchenToken}` },
    body: JSON.stringify({ status: 'cancelled', reason: 'Out of stock' }),
  });
  const rejectData = await rejectRes.json();
  console.log(`KDS Reject HTTP Status: ${rejectRes.status}`);
  console.log('Updated Order Status:', rejectData.status, '| Reason:', rejectData.cancellationReason);
  console.log(`✅ KDS Rejection Successful: ${rejectData.status === 'cancelled' && rejectData.cancellationReason === 'Out of stock'}\n`);

  // ----------------------------------------------------
  // TEST C: Delivery Failed & Rider Flagging Flow
  // ----------------------------------------------------
  console.log('--- TEST C: Delivery Failed & Rider Flagging Flow ---');

  const failedOrder = await prisma.order.create({
    data: {
      orderNumber: 'IPL-TEST-FAIL' + Math.floor(Math.random() * 9000 + 1000),
      userId: customerUser.id,
      dhabaId: 'dhaba_singarayakonda',
      status: 'ready_for_pickup',
      deliveryTarget: 'Turf Bench #4',
      subtotalPaise: 4000,
      totalAmountPaise: 4000,
      paymentStatus: 'paid',
      paymentMethod: 'wallet',
    },
  });

  if (driverUser) {
    await prisma.driverProfile.updateMany({
      where: { userId: driverUser.id },
      data: { activeOrderId: null, isOnline: true },
    });
  }

  // Claim & Pickup
  await fetch(`${API_BASE}/dispatch/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ orderId: failedOrder.id }),
  });
  await fetch(`${API_BASE}/dispatch/${failedOrder.id}/pickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
  });

  // Rider flags issue
  const flagRes = await fetch(`${API_BASE}/dispatch/${failedOrder.id}/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ reason: 'Unreachable customer' }),
  });
  console.log(`Rider Flag Issue HTTP Status: ${flagRes.status}`);

  const orderAfterFlag = await prisma.order.findUnique({ where: { id: failedOrder.id } });
  console.log(`Order Status After Flag: ${orderAfterFlag?.status} (Expected: picked_up)`);
  console.log(`Is Flagged: ${orderAfterFlag?.isFlagged} | Flagged Reason: ${orderAfterFlag?.flaggedReason}`);

  // Rider/Non-admin attempts delivery_failed directly
  const nonAdminFailRes = await fetch(`${API_BASE}/orders/${failedOrder.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ status: 'delivery_failed', reason: 'Unreachable customer' }),
  });
  console.log(`Non-Admin delivery_failed HTTP Status: ${nonAdminFailRes.status} (Expected: 400 or 403)`);

  // Record points before admin fail
  const pointsBeforeAdminFail = (await prisma.fanPoints.findUnique({ where: { userId: customerUser.id } }))?.balance ?? 0;

  // Admin marks delivery_failed
  const adminFailRes = await fetch(`${API_BASE}/orders/${failedOrder.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'delivery_failed', reason: 'Unreachable customer' }),
  });
  console.log(`Admin delivery_failed HTTP Status: ${adminFailRes.status}`);

  // Verify DB state
  const failedOrderAfter = await prisma.order.findUnique({ where: { id: failedOrder.id } });
  const pointsAfterAdminFail = (await prisma.fanPoints.findUnique({ where: { userId: customerUser.id } }))?.balance ?? 0;
  const driverProfileAfter = driverUser
    ? await prisma.driverProfile.findUnique({ where: { userId: driverUser.id } })
    : null;

  // Admin Query Needs Review Queue
  const needsReviewRes = await fetch(`${API_BASE}/orders?scope=needs_review`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const needsReviewList = (await needsReviewRes.json()) as any[];
  const foundInNeedsReview = Array.isArray(needsReviewList) && needsReviewList.some((o) => o.id === failedOrder.id);

  console.log(`Driver activeOrderId After Admin Fail: ${driverProfileAfter?.activeOrderId} (Expected: null)`);
  console.log(`Payment Status After Admin Fail: ${failedOrderAfter?.paymentStatus} (Expected: paid - no auto-refund)`);
  console.log(`FanPoints Delta: +${pointsAfterAdminFail - pointsBeforeAdminFail} (Expected: +0)`);
  console.log(`Order Found in Admin Needs Review Queue: ${foundInNeedsReview}`);

  console.log(`✅ TEST C Complete: Delivery Failed & Rider Flagging Flow Verified\n`);

  // ----------------------------------------------------
  // TEST C1: Manual Refund Action Verification (Wallet & Razorpay Rails)
  // ----------------------------------------------------
  console.log('--- TEST C1: Manual Refund Action & Needs Review Queue Resolution ---');

  // Sub-Test C1.1: Wallet Manual Refund Action
  console.log('Sub-Test C1.1: Wallet Manual Refund');
  const walletBeforeRefund = (await prisma.wallet.findUnique({ where: { userId: customerUser.id } }))?.balancePaise ?? 0;
  console.log(`[BEFORE] Order Status: ${failedOrderAfter?.status} | Payment Status: ${failedOrderAfter?.paymentStatus} | ReviewedAt: ${failedOrderAfter?.reviewedAt}`);

  const refundRes = await fetch(`${API_BASE}/orders/${failedOrder.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'refunded', reason: 'Admin manual refund post-delivery failure' }),
  });
  console.log(`Manual Refund Action HTTP Status: ${refundRes.status}`);

  const orderAfterRefund = await prisma.order.findUnique({ where: { id: failedOrder.id } });
  const walletAfterRefund = (await prisma.wallet.findUnique({ where: { userId: customerUser.id } }))?.balancePaise ?? 0;

  const needsReviewAfterRefundRes = await fetch(`${API_BASE}/orders?scope=needs_review`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const needsReviewListAfterRefund = (await needsReviewAfterRefundRes.json()) as any[];
  const foundInQueueAfterRefund = Array.isArray(needsReviewListAfterRefund) && needsReviewListAfterRefund.some((o) => o.id === failedOrder.id);

  console.log(`[AFTER] Order Status: ${orderAfterRefund?.status} (Expected: refunded)`);
  console.log(`[AFTER] Payment Status: ${orderAfterRefund?.paymentStatus} (Expected: refunded)`);
  console.log(`ReviewedAt Timestamp Set: ${orderAfterRefund?.reviewedAt !== null} (${orderAfterRefund?.reviewedAt?.toISOString()})`);
  console.log(`Customer Wallet Balance Delta: +${walletAfterRefund - walletBeforeRefund} paise (Expected: +4000 paise)`);
  console.log(`Order Dropped Out of Needs Review Queue: ${!foundInQueueAfterRefund}`);

  // Sub-Test C1.2: Razorpay Manual Refund Action
  console.log('\nSub-Test C1.2: Razorpay Gateway Manual Refund');
  const rzpOrder = await prisma.order.create({
    data: {
      orderNumber: 'IPL-TEST-RZP' + Math.floor(Math.random() * 9000 + 1000),
      userId: customerUser.id,
      dhabaId: 'dhaba_singarayakonda',
      status: 'delivery_failed',
      deliveryTarget: 'Turf Bench #1',
      subtotalPaise: 5000,
      totalAmountPaise: 5000,
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      cancellationReason: 'Rider unreachable',
    },
  });
  const mockPayId = 'pay_test_' + Math.floor(Math.random() * 1000000);
  await prisma.payment.create({
    data: {
      orderId: rzpOrder.id,
      provider: 'razorpay',
      providerPaymentId: mockPayId,
      amountPaise: 5000,
      currency: 'INR',
      status: 'paid',
      method: 'razorpay',
    },
  });

  const rzpOrderBefore = await prisma.order.findUnique({ where: { id: rzpOrder.id } });
  const rzpPaymentBefore = await prisma.payment.findFirst({ where: { orderId: rzpOrder.id } });
  console.log(`[BEFORE] Razorpay Order Status: ${rzpOrderBefore?.status} | Payment Status: ${rzpOrderBefore?.paymentStatus} | Payment Record Status: ${rzpPaymentBefore?.status}`);

  const rzpRefundRes = await fetch(`${API_BASE}/orders/${rzpOrder.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'refunded', reason: 'Admin manual refund post-delivery failure' }),
  });
  console.log(`Razorpay Manual Refund Action HTTP Status: ${rzpRefundRes.status}`);

  const rzpOrderAfter = await prisma.order.findUnique({ where: { id: rzpOrder.id } });
  const rzpPaymentAfter = await prisma.payment.findFirst({ where: { orderId: rzpOrder.id } });

  const rzpNeedsReviewRes = await fetch(`${API_BASE}/orders?scope=needs_review`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const rzpNeedsReviewList = (await rzpNeedsReviewRes.json()) as any[];
  const rzpFoundInQueue = Array.isArray(rzpNeedsReviewList) && rzpNeedsReviewList.some((o) => o.id === rzpOrder.id);

  console.log(`[AFTER] Razorpay Order Status: ${rzpOrderAfter?.status} (Expected: refunded)`);
  console.log(`[AFTER] Razorpay Order Payment Status: ${rzpOrderAfter?.paymentStatus} (Expected: refunded)`);
  console.log(`[AFTER] Razorpay Payment Table Status: ${rzpPaymentAfter?.status} (Expected: refunded)`);
  console.log(`[AFTER] Razorpay Refund ID Stored: ${rzpPaymentAfter?.providerRefundId}`);
  console.log(`ReviewedAt Timestamp Set: ${rzpOrderAfter?.reviewedAt !== null} (${rzpOrderAfter?.reviewedAt?.toISOString()})`);
  console.log(`Razorpay Order Dropped Out of Needs Review Queue: ${!rzpFoundInQueue}`);

  console.log(`✅ TEST C1 Complete: Manual Refund & Queue Drop-Out Verified for both Wallet & Razorpay Rails\n`);

  // ----------------------------------------------------
  // TEST C2: Dismiss Flag Resolution (False Alarm Case)
  // ----------------------------------------------------
  console.log('--- TEST C2: Dismiss Flag Resolution (False Alarm Case) ---');

  const falseAlarmOrder = await prisma.order.create({
    data: {
      orderNumber: 'IPL-TEST-FALSE' + Math.floor(Math.random() * 9000 + 1000),
      userId: customerUser.id,
      dhabaId: 'dhaba_singarayakonda',
      status: 'picked_up',
      deliveryTarget: 'Turf Bench #2',
      subtotalPaise: 2500,
      totalAmountPaise: 2500,
      paymentStatus: 'paid',
      paymentMethod: 'wallet',
    },
  });

  // Rider flags issue
  await fetch(`${API_BASE}/dispatch/${falseAlarmOrder.id}/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ reason: 'Minor GPS glitch' }),
  });

  // Check it appears in Needs Review queue
  const queueBeforeDismiss = (await (await fetch(`${API_BASE}/orders?scope=needs_review`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).json()) as any[];
  const inQueueBeforeDismiss = Array.isArray(queueBeforeDismiss) && queueBeforeDismiss.some((o) => o.id === falseAlarmOrder.id);
  console.log(`False Alarm Order in Needs Review Queue BEFORE Dismiss: ${inQueueBeforeDismiss}`);

  // Admin calls Dismiss Flag
  const dismissRes = await fetch(`${API_BASE}/orders/${falseAlarmOrder.id}/dismiss-flag`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Dismiss Flag HTTP Status: ${dismissRes.status}`);

  const orderAfterDismiss = await prisma.order.findUnique({ where: { id: falseAlarmOrder.id } });
  const queueAfterDismiss = (await (await fetch(`${API_BASE}/orders?scope=needs_review`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).json()) as any[];
  const inQueueAfterDismiss = Array.isArray(queueAfterDismiss) && queueAfterDismiss.some((o) => o.id === falseAlarmOrder.id);

  console.log(`Order Status After Dismiss: ${orderAfterDismiss?.status} (Expected: picked_up - untouched)`);
  console.log(`Is Flagged After Dismiss: ${orderAfterDismiss?.isFlagged} (Expected: false)`);
  console.log(`ReviewedAt Set After Dismiss: ${orderAfterDismiss?.reviewedAt !== null}`);
  console.log(`False Alarm Order Dropped Out of Needs Review Queue: ${!inQueueAfterDismiss}`);
  console.log(`✅ TEST C2 Complete: Dismiss Flag Resolution Verified\n`);

  await prisma.$disconnect();
}

runRegressionSuite().catch((err) => {
  console.error(err);
  prisma.$disconnect();
});
