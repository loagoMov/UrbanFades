'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

function CancelBookingContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your request...');

  useEffect(() => {
    if (!id || !token) {
      setStatus('error');
      setMessage('Invalid cancellation link. Missing parameters.');
      return;
    }

    async function performCancellation() {
      try {
        const res = await fetch('/api/booking/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, token }),
        });

        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          setMessage(data.message || 'Your booking has been successfully cancelled.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to cancel the booking.');
        }
      } catch (err) {
        console.error('Cancellation error:', err);
        setStatus('error');
        setMessage('A network error occurred. Please check your connection and try again.');
      }
    }

    performCancellation();
  }, [id, token]);

  return (
    <div className="w-full max-w-md bg-dark-gray p-8 border-2 border-barber-blue shadow-blue-glow text-center rounded-xl">
      <h2 className="text-3xl font-black text-white mb-6 uppercase tracking-tighter">
        Urban Fades <span className="text-white/40">BW</span>
      </h2>

      <div className="py-6 flex flex-col items-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-barber-blue border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400 text-sm">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Cancelled</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{message}</p>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center"
          >
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-sharp-red rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Failed</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{message}</p>
          </motion.div>
        )}
      </div>

      <div className="mt-8 border-t border-white/5 pt-6">
        <a
          href="/"
          className="inline-block w-full py-3 bg-barber-blue hover:bg-barber-blue/80 text-white text-xs font-bold uppercase tracking-widest transition-all duration-300 rounded"
        >
          Book a New Appointment
        </a>
      </div>
    </div>
  );
}

export default function CancelBookingPage() {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center p-6">
      <Suspense fallback={
        <div className="text-center text-white animate-pulse">Loading cancellation client...</div>
      }>
        <CancelBookingContent />
      </Suspense>
    </main>
  );
}
