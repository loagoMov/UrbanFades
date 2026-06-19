'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

function CancelBookingContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'confirming' | 'loading' | 'success' | 'error'>('confirming');
  const [message, setMessage] = useState('Are you sure you want to cancel your booking?');

  if (!id || !token) {
    return (
      <div className="w-full max-w-md bg-dark-gray p-8 border-2 border-red-500 shadow-lg text-center rounded-xl">
        <h2 className="text-3xl font-black text-white mb-6 uppercase tracking-tighter">
          Urban Fades <span className="text-white/40">BW</span>
        </h2>
        <div className="py-6 flex flex-col items-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Invalid Link</h3>
          <p className="text-gray-400 text-sm leading-relaxed">Invalid cancellation link. Missing parameters.</p>
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

  async function performCancellation() {
    setStatus('loading');
    setMessage('Processing cancellation request...');
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

  return (
    <div className="w-full max-w-md bg-dark-gray p-8 border-2 border-barber-blue shadow-blue-glow text-center rounded-xl bg-gray-900 text-white">
      <h2 className="text-3xl font-black text-white mb-6 uppercase tracking-tighter">
        Urban Fades <span className="text-white/40">BW</span>
      </h2>

      <div className="py-6 flex flex-col items-center">
        {status === 'confirming' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center w-full"
          >
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Confirm Cancellation</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">{message}</p>
            
            <button
              onClick={performCancellation}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest transition-all duration-300 rounded shadow-lg shadow-red-600/20 mb-3"
            >
              Yes, Cancel Booking
            </button>
            <a
              href="/"
              className="w-full py-3 bg-gray-800 hover:bg-gray-750 text-gray-350 text-xs font-bold uppercase tracking-widest transition-all duration-300 rounded text-center block"
            >
              Keep My Booking
            </a>
          </motion.div>
        )}

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
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">Failed</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{message}</p>
          </motion.div>
        )}
      </div>

      {status !== 'confirming' && (
        <div className="mt-8 border-t border-white/5 pt-6">
          <a
            href="/"
            className="inline-block w-full py-3 bg-barber-blue hover:bg-barber-blue/80 text-white text-xs font-bold uppercase tracking-widest transition-all duration-300 rounded"
          >
            Book a New Appointment
          </a>
        </div>
      )}
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
