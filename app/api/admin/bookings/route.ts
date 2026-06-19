import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { auth as adminAuth } from '@/lib/firebaseAdmin';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

// Initialize rate limiter: 30 requests per minute for admin queries
const adminBookingsLimiter = createRateLimiter(30, 60 * 1000);

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const limitCheck = adminBookingsLimiter(ip);
    if (!limitCheck.allowed) {
      return rateLimitResponse(limitCheck.resetInSeconds);
    }

    // 1. Require Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split(' ')[1];

    // 2. Verify Firebase ID token & check role claim
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      if (decodedToken.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Fetch bookings from Supabase with the privileged server-side client
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .order('booking_time', { ascending: true });

    if (error) {
      console.error('Supabase error fetching bookings:', error);
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }

    // 4. Generate signed cancellation tokens for each booking on the server
    const secret = process.env.CANCELLATION_SECRET;
    if (!secret) {
      console.error('CRITICAL: CANCELLATION_SECRET environment variable is not set!');
      return NextResponse.json({ error: 'System configuration error' }, { status: 500 });
    }

    const bookingsWithTokens = (bookings || []).map((booking) => {
      const token = crypto.createHmac('sha256', secret).update(booking.id).digest('hex');
      return {
        ...booking,
        cancellation_token: token,
      };
    });

    return NextResponse.json({ bookings: bookingsWithTokens });
  } catch (err: unknown) {
    console.error('Admin bookings API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
