import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

// Initialize rate limiters:
// - GET: 30 requests per minute to prevent scraping availability
// - POST: 5 booking requests per 10 minutes to prevent booking spam
const availabilityRateLimiter = createRateLimiter(30, 60 * 1000);
const bookingCreationRateLimiter = createRateLimiter(5, 10 * 60 * 1000);

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TIMEZONE = 'Africa/Gaborone';

async function getCalendarClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
  });
  return google.calendar({ version: 'v3', auth });
}

const sendWhatsAppNotification = (_name: string, _service: string, _time: string, _phone: string) => {
  // WhatsApp Business API integration to be added
};

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const limitCheck = availabilityRateLimiter(ip);
    if (!limitCheck.allowed) {
      return rateLimitResponse(limitCheck.resetInSeconds);
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid or missing date parameter (must be YYYY-MM-DD)' }, { status: 400 });
    }

    const calendar = await getCalendarClient();
    
    // Define window for availability (09:00 to 18:00) in Africa/Gaborone (UTC+2)
    const timeMin = new Date(`${date}T09:00:00+02:00`).toISOString();
    const timeMax = new Date(`${date}T18:00:00+02:00`).toISOString();

    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    if (!calendarId) {
      return NextResponse.json({ error: 'Google Calendar ID is not configured' }, { status: 500 });
    }

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: TIMEZONE,
        items: [{ id: calendarId }],
      },
    });

    const busySlots = response.data.calendars?.[calendarId]?.busy || [];
    
    // Generate 45-hour/minute slots with a 5-minute buffer (50 minutes total block)
    const availableSlots = [];
    let current = new Date(timeMin);
    const end = new Date(timeMax);

    while (current < end) {
      const slotStart = new Date(current);
      // 45-minute window for the service itself
      const slotEnd = new Date(current.getTime() + 45 * 60000);
      
      const isBusy = busySlots.some(busy => {
        const busyStart = new Date(busy.start!);
        const busyEnd = new Date(busy.end!);
        
        // Direct overlap check: since booked slots are already saved with the 5-minute buffer (50 mins total),
        // checking direct overlap prevents double-booking while preserving the 5-minute buffer.
        return (slotStart < busyEnd && slotEnd > busyStart);
      });

      const formatTime = (d: Date) => {
        const tz = process.env.TZ || 'Africa/Gaborone';
        return d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: tz,
        }).replace(/^0/, ''); // Clean leading zeros (e.g. 09:00 AM → 9:00 AM)
      };

      const now = new Date();
      const isPast = slotStart < now;

      availableSlots.push({
        time: `${formatTime(slotStart)} - ${formatTime(slotEnd)}`,
        iso: slotStart.toISOString(),
        available: !isBusy && !isPast
      });

      // Increment to next slot: 45 min cut + 5 min buffer = 50 mins
      current = new Date(current.getTime() + 50 * 60000);
    }

    return NextResponse.json(availableSlots);
  } catch (error: unknown) {
    console.error('Booking GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limitCheck = bookingCreationRateLimiter(ip);
    if (!limitCheck.allowed) {
      return rateLimitResponse(limitCheck.resetInSeconds);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const { name, phone, service, startTime, hasLineDesigns } = body;

    // Strict validation
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.length > 50) {
      return NextResponse.json({ error: 'Invalid name (must be between 2 and 50 characters)' }, { status: 400 });
    }

    // Phone validation (simple international and regional regex, between 7 and 15 digits)
    if (!phone || typeof phone !== 'string' || !/^\+?[0-9\s-]{7,15}$/.test(phone.trim())) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    if (!service || typeof service !== 'string' || service.length > 100) {
      return NextResponse.json({ error: 'Invalid service selected' }, { status: 400 });
    }

    if (!startTime || typeof startTime !== 'string' || isNaN(Date.parse(startTime))) {
      return NextResponse.json({ error: 'Invalid start time format (must be a valid ISO string)' }, { status: 400 });
    }

    const start = new Date(startTime);
    // Prevent booking in the past
    if (start.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Booking time cannot be in the past' }, { status: 400 });
    }

    // Fetch the correct service duration from Supabase
    const { data: serviceData, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('duration_minutes')
      .eq('name', service)
      .single();

    const duration = serviceData?.duration_minutes || 30;
    const end = new Date(start.getTime() + (duration + 5) * 60000);

    const displayName = `${service}${hasLineDesigns ? ' + Line Designs' : ''}`;

    // 2. Create Google Calendar Event
    const calendar = await getCalendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    
    if (!calendarId) {
      return NextResponse.json({ error: 'Google Calendar ID is not configured' }, { status: 500 });
    }

    const event = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: {
        summary: `${displayName} - ${name}`,
        description: `WhatsApp: ${phone}\nLine Designs: ${hasLineDesigns ? 'Yes (P20)' : 'No'}`,
        start: {
          dateTime: start.toISOString(),
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: TIMEZONE,
        },
      },
    });

    // 1. Log to Supabase (now including google_event_id)
    const { data: insertedRows, error: supabaseError } = await supabaseAdmin
      .from('bookings')
      .insert([
        { 
          customer_name: name, 
          customer_phone: phone, 
          service_name: displayName, 
          booking_time: start.toISOString(),
          status: 'confirmed',
          google_event_id: event.data.id || null
        }
      ])
      .select('id')
      .single();

    if (supabaseError) {
      console.error('Supabase Logging Error:', supabaseError);
    }

    // 3. WhatsApp Notification Placeholder
    sendWhatsAppNotification(name, displayName, start.toLocaleTimeString(), phone);

    return NextResponse.json({ 
      success: true, 
      eventId: event.data.id,
      dbLogged: !supabaseError,
      bookingId: insertedRows?.id || null
    });
  } catch (error: unknown) {
    console.error('Booking POST Error:', error);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
