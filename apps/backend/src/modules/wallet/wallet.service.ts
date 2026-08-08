import { Injectable, BadRequestException, Logger } from '@nestjs/common';

export interface WalletLedger {
  userId: string;
  balance: number;
  fanPoints: number;
  transactions: { id: string; amount: number; type: 'topup' | 'deduct'; description: string; timestamp: string }[];
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private userLedgers: Map<string, WalletLedger> = new Map();

  private getOrCreateLedger(userId: string): WalletLedger {
    if (!this.userLedgers.has(userId)) {
      this.userLedgers.set(userId, {
        userId,
        balance: 500, // Initial seed balance
        fanPoints: 100, // Initial Fan Points
        transactions: [
          {
            id: 'tx_seed',
            amount: 500,
            type: 'topup',
            description: 'Welcome Sign-up Bonus Credit',
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }
    return this.userLedgers.get(userId)!;
  }

  getWalletBalance(userId: string): WalletLedger {
    return this.getOrCreateLedger(userId);
  }

  topUpWallet(userId: string, amount: number, description = 'UPI Top-Up'): WalletLedger {
    if (amount <= 0) throw new BadRequestException('Top-up amount must be greater than zero');
    const ledger = this.getOrCreateLedger(userId);

    ledger.balance += amount;
    ledger.fanPoints += Math.floor(amount / 10); // 1 Fan Point per ₹10 spent
    ledger.transactions.unshift({
      id: `tx_${Date.now()}`,
      amount,
      type: 'topup',
      description,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`💰 User ${userId} Wallet Top-up +₹${amount}. New Balance: ₹${ledger.balance}`);
    return ledger;
  }

  deductWallet(userId: string, amount: number, description = 'Order Payment'): WalletLedger {
    const ledger = this.getOrCreateLedger(userId);
    if (ledger.balance < amount) {
      throw new BadRequestException('Insufficient wallet balance!');
    }

    ledger.balance -= amount;
    ledger.transactions.unshift({
      id: `tx_${Date.now()}`,
      amount,
      type: 'deduct',
      description,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`💸 User ${userId} Wallet Deduct -₹${amount}. New Balance: ₹${ledger.balance}`);
    return ledger;
  }
}
