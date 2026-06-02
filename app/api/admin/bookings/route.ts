import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { auth as adminAuth } from '@/lib/firebaseAdmin';

export async function GET(request: Request) {
  // 1. Require Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const idToken = authHeader.split(' ')[1];

  // 2. Verify Firebase ID token
  try {
    await adminAuth.verifyIdToken(idToken);
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
  const secret = process.env.CANCELLATION_SECRET || 'fallback-secret-key-12345';
  const bookingsWithTokens = (bookings || []).map((booking) => {
    const token = crypto.createHmac('sha256', secret).update(booking.id).digest('hex');
    return {
      ...booking,
      cancellation_token: token,
    };
  });

  return NextResponse.json({ bookings: bookingsWithTokens });
}
export { crypto };
