// ===================================================
// IPL Dhaba Backend — Internal Wallet & Fan Points Module
// Balance Top-Ups, Internal Ledger & Loyalty Points
// ===================================================

import { Router } from 'express';
import { Logger } from '../../shared/logger';

export const walletRouter = Router();

// In-memory ledger balance mock
let userWallet = {
  balance: 450,
  fanPoints: 120,
  currency: 'INR',
};

// Get Wallet & Loyalty Points Balance
walletRouter.get('/balance', (req, res) => {
  res.json({
    success: true,
    data: userWallet,
  });
});

// Top-Up Internal Wallet
walletRouter.post('/topup', (req, res) => {
  const { amount, source = 'UPI QR Scan' } = req.body;
  const numAmount = Number(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, error: 'Valid top-up amount required' });
  }

  userWallet.balance += numAmount;
  userWallet.fanPoints += Math.floor(numAmount / 10);

  Logger.info(`Wallet Top-Up: +₹${numAmount} via ${source}. New Balance: ₹${userWallet.balance}`, (req as any).id, 'WalletModule');

  res.json({
    success: true,
    data: {
      newBalance: userWallet.balance,
      earnedFanPoints: userWallet.fanPoints,
      transactionId: `tx_wlt_${Date.now()}`,
    },
  });
});
