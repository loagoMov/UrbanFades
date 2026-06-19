import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { google } from 'googleapis';
import { auth as adminAuth } from '@/lib/firebaseAdmin';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

// Initialize rate limiters:
// - POST (Customer cancel): 5 requests per 10 minutes to prevent brute forcing signature tokens
// - DELETE (Admin cancel): 10 requests per minute
const customerCancelLimiter = createRateLimiter(5, 10 * 60 * 1000);
const adminCancelLimiter = createRateLimiter(10, 60 * 1000);

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

async function getCalendarClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
  });
  return google.calendar({ version: 'v3', auth });
}

// 1. POST handler for customer cancellation using signed tokens (no login required)
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limitCheck = customerCancelLimiter(ip);
    if (!limitCheck.allowed) {
      return rateLimitResponse(limitCheck.resetInSeconds);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const { id, token } = body;
    if (!id || typeof id !== 'string' || !token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    // Verify cryptographic token to prevent tampering
    const secret = process.env.CANCELLATION_SECRET;
    if (!secret) {
      console.error('CRITICAL: CANCELLATION_SECRET environment variable is not set!');
      return NextResponse.json({ error: 'System configuration error' }, { status: 500 });
    }
    
    const expectedToken = crypto.createHmac('sha256', secret).update(id).digest('hex');

    if (token !== expectedToken) {
      return NextResponse.json({ error: 'Invalid or expired cancellation link' }, { status: 403 });
    }

    // Fetch booking details
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status === 'cancelled') {
      return NextResponse.json({ success: true, message: 'Already cancelled' });
    }

    // Check cancellation deadline rule (must be > 1 hour before)
    const appointmentTime = new Date(booking.booking_time);
    const now = new Date();
    const oneHourInMs = 60 * 60 * 1000;

    if (appointmentTime.getTime() - now.getTime() < oneHourInMs) {
      return NextResponse.json({ 
        error: 'Late cancellation. Bookings cannot be cancelled less than 1 hour before the scheduled time.' 
      }, { status: 400 });
    }

    // Update status in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) {
      console.error('Database update error during cancellation:', updateError);
      return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
    }

    // Delete Google Calendar event if event ID exists
    if (booking.google_event_id) {
      try {
        const calendar = await getCalendarClient();
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        if (calendarId) {
          await calendar.events.delete({
            calendarId,
            eventId: booking.google_event_id,
          });
        }
      } catch (calErr) {
        console.error('Failed to delete Google Calendar event:', calErr);
        // Do not crash the response since DB status is already marked cancelled
      }
    }

    return NextResponse.json({ success: true, message: 'Booking successfully cancelled' });
  } catch (err: unknown) {
    console.error('Cancellation endpoint error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 2. DELETE handler for admin cancellation (requires Firebase Auth token verification)
export async function DELETE(request: Request) {
  try {
    const ip = getClientIp(request);
    const limitCheck = adminCancelLimiter(ip);
    if (!limitCheck.allowed) {
      return rateLimitResponse(limitCheck.resetInSeconds);
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split(' ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      // Enforce admin custom claim role check
      if (decodedToken.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid booking ID' }, { status: 400 });
    }

    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Update status in Supabase to cancelled
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) {
      console.error('Database update error during cancellation:', updateError);
      return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
    }

    // Delete Google Calendar event
    if (booking.google_event_id) {
      try {
        const calendar = await getCalendarClient();
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        if (calendarId) {
          await calendar.events.delete({
            calendarId,
            eventId: booking.google_event_id,
          });
        }
      } catch (calErr) {
        console.error('Failed to delete Google Calendar event:', calErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Booking cancelled by admin' });
  } catch (err: unknown) {
    console.error('Admin cancellation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
