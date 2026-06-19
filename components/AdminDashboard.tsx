"use client";

import { useState, useEffect } from "react";
import { format, isAfter, isBefore, parseISO, isToday, isTomorrow } from "date-fns";
import { auth as clientAuth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  booking_time: string;
  status: string;
  created_at?: string;
  cancellation_token?: string;
}

interface AdminDashboardProps {
  initialBookings: Booking[];
  onRefresh: () => Promise<any>;
  isRefreshing: boolean;
}

export default function AdminDashboard({ initialBookings, onRefresh, isRefreshing }: AdminDashboardProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    setBookings(initialBookings);
    setLastUpdated(new Date());
  }, [initialBookings]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"upcoming" | "past" | "all">("upcoming");
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const now = new Date();

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(clientAuth);
      // The onAuthStateChanged listener in AuthRedirect will handle redirecting to /admin/login
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Handle admin cancellation
  const handleCancelBooking = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    setIsDeletingId(id);

    try {
      const user = clientAuth.currentUser;
      if (!user) {
        alert("Unauthorized: Please sign in again.");
        return;
      }
      const token = await user.getIdToken();

      const res = await fetch(`/api/booking/cancel?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // Update local state status to cancelled
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b))
        );
        onRefresh();
      } else {
        const err = await res.json();
        alert(`Failed to cancel: ${err.error}`);
      }
    } catch (err) {
      console.error("Cancellation error:", err);
      alert("An unexpected error occurred during cancellation.");
    } finally {
      setIsDeletingId(null);
    }
  };

  // Generate Natural tone WhatsApp confirmation link with secure cancellation parameters
  const getWhatsAppUrl = (
    phone: string,
    name: string,
    service: string,
    timeStr: string,
    bookingId: string,
    cancelToken?: string
  ) => {
    const cleanPhone = phone.replace(/\D/g, "");

    let formattedDate = "";
    let formattedTime = "";
    try {
      const date = parseISO(timeStr);
      formattedDate = format(date, "EEEE, MMM d");
      formattedTime = format(date, "h:mm a");
    } catch (e) {
      formattedDate = "your scheduled date";
      formattedTime = "your scheduled time";
    }

    // Build URL cancellation parameters
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const cancelLink = `${appUrl}/booking/cancel?id=${bookingId}&token=${cancelToken || ""}`;

    // Natural, cool barber-to-client confirmation tone with policy details
    const message = `Hey ${name}, just confirming your booking for ${service} on ${formattedDate} at ${formattedTime}. See you at the shop!\n\nStore Location: https://maps.app.goo.gl/q7aquNjt7ESNjD6UA\n\nNeed to cancel? You can cancel up to 1 hour before your booking here: ${cancelLink} (cancellations under 1 hour are not permitted).`;
    
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const filteredBookings = bookings.filter((booking) => {
    const bookingDate = parseISO(booking.booking_time);

    if (filterType === "upcoming") {
      const isUpcomingTodayOrTomorrow = isAfter(bookingDate, now) && (isToday(bookingDate) || isTomorrow(bookingDate));
      if (!isUpcomingTodayOrTomorrow || booking.status === "cancelled") {
        return false;
      }
    }
    if (filterType === "past" && isAfter(bookingDate, now)) {
      return false;
    }

    const matchesName = booking.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPhone = booking.customer_phone.includes(searchTerm);
    const matchesService = booking.service_name.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesName || matchesPhone || matchesService;
  });

  return (
    <div className="max-w-6xl mx-auto z-10 relative pt-8 md:pt-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 pb-8 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-barber-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="6" cy="6" r="3" strokeWidth={2} />
              <circle cx="6" cy="18" r="3" strokeWidth={2} />
              <line x1="9" y1="8.5" x2="19" y2="17.5" strokeWidth={2} strokeLinecap="round" />
              <line x1="9" y1="15.5" x2="19" y2="6.5" strokeWidth={2} strokeLinecap="round" />
            </svg>
            <span className="text-xs uppercase tracking-widest text-barber-blue font-bold font-mono bg-barber-blue/10 px-2.5 py-1 rounded">
              Management Portal
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mt-3">
            URBAN FADES <span className="text-white/40">BW</span>
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest animate-pulse">
              Welcome Back Warona
            </p>
            <span className="text-white/20 text-xs">•</span>
            <p className="text-[11px] text-gray-400 font-mono">
              {lastUpdated ? `Last updated: ${format(lastUpdated, "h:mm:ss a")}` : "Loading..."}
            </p>
            {isRefreshing && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>
        </div>
        <div className="mt-6 md:mt-0 flex flex-wrap gap-3">
          <button
            onClick={() => onRefresh()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-barber-blue/10 border border-barber-blue/20 text-xs font-semibold uppercase tracking-wider text-barber-blue hover:text-white hover:bg-barber-blue hover:border-barber-blue transition-all duration-300 rounded disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M21 20v-5h-.581m0 0a8.003 8.003 0 01-15.357-2"
              />
            </svg>
            <span>{isRefreshing ? "Syncing..." : "Sync Now"}</span>
          </button>
          <a
            href="/admin/analytics"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600/10 border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider text-emerald-400 hover:text-white hover:bg-emerald-600 hover:border-emerald-600 transition-all duration-300 rounded"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span>View Analytics</span>
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-white hover:border-white transition-all duration-300 rounded"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>View Front Booking</span>
          </a>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600/10 border border-red-500/20 text-xs font-semibold uppercase tracking-wider text-red-400 hover:text-white hover:bg-red-600 hover:border-red-600 transition-all duration-300 rounded"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Control Panel: Modern Search & Segmented Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-10 items-stretch">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search bookings by name or service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-gray/60 border border-white/5 rounded px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-barber-blue focus:bg-dark-gray transition duration-300"
          />
        </div>

        {/* Custom Segmented Control */}
        <div className="flex bg-dark-gray/40 border border-white/5 p-1 rounded gap-1">
          {(["upcoming", "past", "all"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-6 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all duration-300 ${
                filterType === type
                  ? "bg-barber-blue text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Minimal Cards (Modern Booking Feed) */}
      {filteredBookings.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/5 rounded-xl bg-dark-gray/20">
          <svg
            className="w-8 h-8 text-gray-600 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-gray-500 font-medium">No bookings found matching filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBookings.map((booking) => {
            let formattedDate = "";
            let formattedTime = "";
            try {
              const bTime = parseISO(booking.booking_time);
              formattedDate = format(bTime, "EEEE, MMMM d");
              formattedTime = format(bTime, "h:mm a");
            } catch (e) {
              formattedDate = booking.booking_time;
            }

            const isUpcoming = isAfter(parseISO(booking.booking_time), now) && booking.status !== "cancelled";
            const isCancelled = booking.status === "cancelled";

            return (
              <div
                key={booking.id}
                className={`bg-dark-gray/30 border border-white/5 rounded-lg p-6 hover:border-white/10 hover:bg-dark-gray/50 transition-all duration-300 flex flex-col justify-between group ${
                  isCancelled ? "opacity-50" : ""
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight">{booking.customer_name}</h3>
                      <p className="text-xs font-mono text-gray-500 mt-0.5">{booking.customer_phone}</p>
                    </div>
                    <span
                      className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full ${
                        isCancelled
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : isUpcoming
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-white/5 text-gray-500 border border-white/5"
                      }`}
                    >
                      {isCancelled ? "Cancelled" : isUpcoming ? "Upcoming" : "Completed"}
                    </span>
                  </div>

                  <div className="space-y-2 border-y border-white/5 py-4 mb-6">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Service</span>
                      <span className="text-white font-medium">{booking.service_name}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Date</span>
                      <span className="text-white font-medium">{formattedDate}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Time Slot</span>
                      <span className="text-barber-blue font-bold font-mono">{formattedTime}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {isCancelled ? (
                    <button
                      disabled
                      className="flex-1 text-center block bg-white/5 text-gray-600 text-xs font-bold uppercase tracking-widest py-3 rounded cursor-not-allowed border border-white/5"
                    >
                      Booking Cancelled
                    </button>
                  ) : isUpcoming ? (
                    <>
                      <a
                        href={getWhatsAppUrl(
                          booking.customer_phone,
                          booking.customer_name,
                          booking.service_name,
                          booking.booking_time,
                          booking.id,
                          booking.cancellation_token
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-2 text-center block bg-white hover:bg-barber-blue hover:text-white text-black text-xs font-bold uppercase tracking-widest py-3 px-4 rounded transition-all duration-300 shadow-sm"
                      >
                        Send Confirmation
                      </a>
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        disabled={isDeletingId === booking.id}
                        className="flex-1 text-center bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-600 text-red-400 hover:text-white text-xs font-bold uppercase tracking-widest py-3 rounded transition-all duration-300"
                      >
                        {isDeletingId === booking.id ? "Cancelling..." : "Cancel"}
                      </button>
                    </>
                  ) : (
                    <button
                      disabled
                      className="flex-1 text-center block bg-white/5 text-gray-600 text-xs font-bold uppercase tracking-widest py-3 rounded cursor-not-allowed border border-white/5"
                    >
                      Booking Passed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
