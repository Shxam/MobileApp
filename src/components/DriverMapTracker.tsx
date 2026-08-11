import React from 'react';
import { LiveTrackingMap } from './LiveTrackingMap';

interface DriverMapTrackerProps {
  orderId: string;
  deliveryTarget: string;
  estimatedMinutes?: number;
}

export const DriverMapTracker: React.FC<DriverMapTrackerProps> = ({ orderId, deliveryTarget }) => {
  return (
    <LiveTrackingMap
      orderId={orderId}
      deliveryTarget={deliveryTarget}
      className="w-full shadow-lg"
    />
  );
};
