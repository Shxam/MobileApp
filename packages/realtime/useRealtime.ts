import { useEffect, useRef, useState } from 'react';
import { connectRealtime, type ConnectionState, type RealtimeConnection, type RealtimeHandlers } from './client';

/**
 * Holds one authenticated socket for the lifetime of a token.
 *
 * Handlers are kept in a ref and read through a stable wrapper, so a component
 * that re-renders — which is every component, on every event this socket
 * delivers — does not tear the connection down and rebuild it. Passing the
 * caller's handlers straight to `connectRealtime` in a `useEffect` dependency
 * list would reconnect on each render and, since each reconnect re-runs the
 * handshake, would produce a connect storm that looks exactly like the polling
 * this replaces.
 */
export function useRealtime(token: string, handlers: RealtimeHandlers): {
  state: ConnectionState;
  detail: string;
  connection: RealtimeConnection | null;
} {
  const [state, setState] = useState<ConnectionState>('connecting');
  const [detail, setDetail] = useState('');
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!token) {
      setState('offline');
      return;
    }

    const connection = connectRealtime(token, {
      onState: (next, why) => {
        setState(next);
        setDetail(why ?? '');
        handlersRef.current.onState?.(next, why);
      },
      onOrderCreated: (payload) => handlersRef.current.onOrderCreated?.(payload),
      onOrderUpdated: (payload) => handlersRef.current.onOrderUpdated?.(payload),
      onOrderOffered: (payload) => handlersRef.current.onOrderOffered?.(payload),
      onOrderTaken: (payload) => handlersRef.current.onOrderTaken?.(payload),
      onDeliveryOtp: (payload) => handlersRef.current.onDeliveryOtp?.(payload),
      onDriverLocation: (payload) => handlersRef.current.onDriverLocation?.(payload),
      onPaymentUpdated: (payload) => handlersRef.current.onPaymentUpdated?.(payload),
      onWalletUpdated: (payload) => handlersRef.current.onWalletUpdated?.(payload),
    });
    connectionRef.current = connection;

    return () => {
      connection.close();
      connectionRef.current = null;
    };
  }, [token]);

  return { state, detail, connection: connectionRef.current };
}
