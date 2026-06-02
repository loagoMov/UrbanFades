"use client";

import { useState } from "react";
import { format, isAfter, isBefore, parseISO } from "date-fns";
import { auth as clientAuth } from "@/lib/firebase";

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
}

export default function AdminDashboard({ initialBookings }: AdminDashboardProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"upcoming" | "past" | "all">("upcoming");
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const now = new Date();

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

    if (filterType === "upcoming" && (isBefore(bookingDate, now) || booking.status === "cancelled")) {
      return false;
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
    <div className="max-w-6xl mx-auto z-10 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 pb-8 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">💈</span>
            <span className="text-xs uppercase tracking-widest text-barber-blue font-bold font-mono bg-barber-blue/10 px-2.5 py-1 rounded">
              Management Portal
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mt-3">
            URBAN FADES <span className="text-white/40">BW</span>
          </h1>
          <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest mt-2 animate-pulse">
            Welcome Back Warona
          </p>
        </div>
        <div className="mt-6 md:mt-0">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-white hover:border-white transition-all duration-300 rounded"
          >
            <span>←</span> View Front Booking
          </a>
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
          <span className="text-3xl block mb-3 text-gray-600">📅</span>
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
