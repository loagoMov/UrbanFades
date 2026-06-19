"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { format, parseISO, startOfMonth, subMonths, isAfter, isBefore } from "date-fns";
import AuthRedirect from "@/components/AuthRedirect";

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  booking_time: string;
  status: string;
  created_at?: string;
}

const fetcher = async (url: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const idToken = await user.getIdToken(true);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch bookings");
  }
  const data = await res.json();
  return data.bookings || [];
};

export default function AdminAnalyticsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Cross-filtering States
  const [selectedMonthLabel, setSelectedMonthLabel] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const { data: bookings = [], error, isValidating } = useSWR<Booking[]>(
    user ? "/api/admin/bookings" : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  const initialLoading = authLoading || (user && !bookings.length && !error);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStart = startOfMonth(now);

  const validBookings = bookings.filter((b) => b.status !== "cancelled");

  // 1. DATASET FOR MONTHLY VOLUME (Filtered by selected service if set)
  const bookingsForMonthlyVolume = selectedService
    ? validBookings.filter((b) => b.service_name === selectedService)
    : validBookings;

  // 2. DATASET FOR TRENDING SERVICES (Filtered by selected month if set)
  const bookingsForTrendingCuts = selectedMonthLabel
    ? validBookings.filter((b) => {
        try {
          return format(parseISO(b.booking_time), "MMM yyyy") === selectedMonthLabel;
        } catch {
          return false;
        }
      })
    : validBookings;

  // 3. DATASET FOR OVERALL KPIs & PEAK HOURS (Filtered by BOTH selected month & service)
  const bookingsForKPIsAndHours = validBookings.filter((b) => {
    try {
      if (selectedService && b.service_name !== selectedService) return false;
      if (selectedMonthLabel) {
        const monthLabel = format(parseISO(b.booking_time), "MMM yyyy");
        if (monthLabel !== selectedMonthLabel) return false;
      }
      return true;
    } catch {
      return false;
    }
  });

  // KPI Calculations (reacts to selected filters)
  const totalBookingsCount = bookings.filter((b) => {
    try {
      if (selectedService && b.service_name !== selectedService) return false;
      if (selectedMonthLabel) {
        const monthLabel = format(parseISO(b.booking_time), "MMM yyyy");
        if (monthLabel !== selectedMonthLabel) return false;
      }
      return true;
    } catch {
      return false;
    }
  }).length;

  const cancelledBookingsCount = bookings.filter((b) => {
    if (b.status !== "cancelled") return false;
    try {
      if (selectedService && b.service_name !== selectedService) return false;
      if (selectedMonthLabel) {
        const monthLabel = format(parseISO(b.booking_time), "MMM yyyy");
        if (monthLabel !== selectedMonthLabel) return false;
      }
      return true;
    } catch {
      return false;
    }
  }).length;

  const activeBookingsCount = bookingsForKPIsAndHours.length;

  const annualBookings = bookingsForKPIsAndHours.filter((b) => {
    try {
      return parseISO(b.booking_time).getFullYear() === currentYear;
    } catch {
      return false;
    }
  });

  const monthlyBookings = bookingsForKPIsAndHours.filter((b) => {
    try {
      return isAfter(parseISO(b.booking_time), currentMonthStart);
    } catch {
      return false;
    }
  });

  const completionRate = totalBookingsCount > 0 
    ? Math.round(((totalBookingsCount - cancelledBookingsCount) / totalBookingsCount) * 100) 
    : 100;

  // Trending cuts generation from filtered dataset
  const serviceCounts: { [key: string]: number } = {};
  bookingsForTrendingCuts.forEach((b) => {
    const name = b.service_name || "Unknown Service";
    serviceCounts[name] = (serviceCounts[name] || 0) + 1;
  });

  const trendingCuts = Object.entries(serviceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const maxServiceCount = trendingCuts[0]?.count || 1;
  const totalServiceBookings = trendingCuts.reduce((acc, curr) => acc + curr.count, 0);

  // Monthly buckets generation from filtered dataset
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(now, 5 - i);
    return {
      label: format(d, "MMM yyyy"),
      start: startOfMonth(d),
      end: startOfMonth(subMonths(d, -1)),
      count: 0,
    };
  });

  last6Months.forEach((monthBucket) => {
    monthBucket.count = bookingsForMonthlyVolume.filter((b) => {
      try {
        const time = parseISO(b.booking_time);
        return isAfter(time, monthBucket.start) && isBefore(time, monthBucket.end);
      } catch {
        return false;
      }
    }).length;
  });

  const maxMonthCount = Math.max(...last6Months.map((m) => m.count), 1);

  // Peak hours generation from filtered dataset
  const hourlyBuckets = Array.from({ length: 12 }).map((_, i) => {
    const hour = i + 8; // 8 AM to 7 PM
    return {
      hour,
      label: format(new Date().setHours(hour, 0), "h a"),
      count: 0,
    };
  });

  bookingsForKPIsAndHours.forEach((b) => {
    try {
      const hour = parseISO(b.booking_time).getHours();
      const bucket = hourlyBuckets.find((h) => h.hour === hour);
      if (bucket) {
        bucket.count += 1;
      }
    } catch {}
  });

  const maxHourCount = Math.max(...hourlyBuckets.map((h) => h.count), 1);

  const segmentColors = [
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#8b5cf6", // Purple
    "#f59e0b", // Amber
    "#ec4899", // Pink
    "#06b6d4", // Cyan
  ];

  return (
    <>
      <AuthRedirect />
      {initialLoading ? (
        <div className="flex items-center justify-center min-h-screen bg-black text-white">
          <div className="animate-pulse text-lg tracking-widest font-mono">CALCULATING ANALYTICS...</div>
        </div>
      ) : (
        <main className="min-h-screen bg-black text-white p-6 md:p-12 relative overflow-hidden">
          <div className="max-w-6xl mx-auto z-10 relative">
            
            {/* Header / Navigation */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 pb-8 border-b border-white/5 gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <svg
                    className="w-6 h-6 text-emerald-400"
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
                  <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold font-mono bg-emerald-400/10 px-2.5 py-1 rounded">
                    Analytics Portal
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mt-3">
                  PERFORMANCE INSIGHTS
                </h1>
                <p className="text-xs text-gray-400 mt-2">
                  Real-time data visualization of salon bookings and trending cuts
                </p>

                {/* Filters Status Indicator */}
                {(selectedMonthLabel || selectedService) && (
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Active Filters:</span>
                    {selectedMonthLabel && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-barber-blue/10 border border-barber-blue/30 text-[10px] font-bold text-barber-blue rounded-full">
                        Month: {selectedMonthLabel}
                        <button 
                          onClick={() => setSelectedMonthLabel(null)} 
                          className="hover:text-white transition-colors"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                    {selectedService && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 text-[10px] font-bold text-purple-400 rounded-full">
                        Cut: {selectedService}
                        <button 
                          onClick={() => setSelectedService(null)} 
                          className="hover:text-white transition-colors"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setSelectedMonthLabel(null);
                        setSelectedService(null);
                      }}
                      className="text-[10px] font-bold text-red-400 hover:text-red-300 underline font-mono"
                    >
                      Reset All
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-6 md:mt-0 flex gap-3">
                <a
                  href="/admin"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 text-xs font-semibold uppercase tracking-wider text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 rounded"
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
                  <span>Return to Dashboard</span>
                </a>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              
              {/* Card 1: All Time */}
              <div className="bg-dark-gray/30 border border-white/5 rounded-xl p-6 hover:border-white/10 transition-all duration-300">
                <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Filtered Bookings</p>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-4xl font-black tracking-tight text-white">{totalBookingsCount}</span>
                  <span className="text-xs text-gray-400 font-medium">appointments</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-3 font-mono">
                  Active: {activeBookingsCount} | Cancelled: {cancelledBookingsCount}
                </p>
              </div>

              {/* Card 2: Annual */}
              <div className="bg-dark-gray/30 border border-white/5 rounded-xl p-6 hover:border-white/10 transition-all duration-300">
                <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Annual Volume ({currentYear})</p>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-4xl font-black tracking-tight text-barber-blue">{annualBookings.length}</span>
                  <span className="text-xs text-gray-400 font-medium">completed/upcoming</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-3 font-mono">
                  Excludes cancelled appointments
                </p>
              </div>

              {/* Card 3: Monthly */}
              <div className="bg-dark-gray/30 border border-white/5 rounded-xl p-6 hover:border-white/10 transition-all duration-300">
                <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">This Month</p>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-4xl font-black tracking-tight text-emerald-400">{monthlyBookings.length}</span>
                  <span className="text-xs text-emerald-400/80 font-semibold">
                    {activeBookingsCount > 0 ? `(${Math.round((monthlyBookings.length / activeBookingsCount) * 100)}%)` : ""}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-3 font-mono">
                  Share of selected filters
                </p>
              </div>

              {/* Card 4: Fulfillment Rate */}
              <div className="bg-dark-gray/30 border border-white/5 rounded-xl p-6 hover:border-white/10 transition-all duration-300">
                <p className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Fulfillment Rate</p>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-4xl font-black tracking-tight text-purple-400">{completionRate}%</span>
                  <span className="text-xs text-gray-400 font-medium">completion</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 mt-4 overflow-hidden">
                  <div 
                    className="bg-purple-500 h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>

            </div>

            {/* Graphs Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Monthly Volume (Bar Chart) */}
              <div className="lg:col-span-2 bg-dark-gray/20 border border-white/5 rounded-xl p-6 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-white">Booking Volume</h3>
                    <p className="text-xs text-gray-500">
                      {selectedService ? `Monthly trend for "${selectedService}"` : "Monthly counts of valid bookings"}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 bg-white/5 px-2 py-0.5 rounded font-mono">
                    Click Bar to Filter Month
                  </span>
                </div>
                
                {/* SVG Bar Chart */}
                <div className="w-full h-64 relative flex-1 mt-6">
                  <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                    {/* Gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => (
                      <line
                        key={idx}
                        x1="30"
                        y1={10 + r * 150}
                        x2="480"
                        y2={10 + r * 150}
                        stroke="rgba(255, 255, 255, 0.03)"
                        strokeWidth="1"
                      />
                    ))}

                    {/* Bars */}
                    {last6Months.map((m, idx) => {
                      const xSpace = 450 / 6;
                      const x = 40 + idx * xSpace;
                      const barHeight = (m.count / maxMonthCount) * 140;
                      const y = 160 - barHeight;
                      const barWidth = 35;

                      const isSelected = selectedMonthLabel === m.label;
                      const isAnySelected = selectedMonthLabel !== null;
                      
                      // Dim unselected bars to highlight selected
                      const opacity = isAnySelected ? (isSelected ? "1" : "0.3") : "0.75";

                      return (
                        <g 
                          key={idx} 
                          className="group cursor-pointer" 
                          onClick={() => setSelectedMonthLabel(isSelected ? null : m.label)}
                        >
                          {/* Main Bar */}
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx="4"
                            style={{ opacity }}
                            className={`transition-all duration-300 ${
                              isSelected ? "fill-barber-blue" : "fill-barber-blue/80 hover:fill-barber-blue"
                            }`}
                          />
                          {/* Glow Overlay */}
                          <rect
                            x={x - 2}
                            y={y - 2}
                            width={barWidth + 4}
                            height={barHeight + 4}
                            rx="6"
                            fill="none"
                            style={{ opacity: isSelected ? "1" : "0" }}
                            className="stroke-barber-blue/40 stroke-[2px] group-hover:opacity-100 transition-opacity duration-300"
                          />
                          {/* Count text label */}
                          <text
                            x={x + barWidth / 2}
                            y={y - 8}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="10"
                            className={`font-bold font-mono transition-opacity duration-300 ${
                              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            {m.count}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  
                  {/* Monthly Labels */}
                  <div className="flex justify-between pl-[40px] pr-[15px] pt-2 border-t border-white/5">
                    {last6Months.map((m, idx) => {
                      const isSelected = selectedMonthLabel === m.label;
                      return (
                        <div 
                          key={idx} 
                          className={`text-center w-[60px] cursor-pointer rounded py-0.5 transition-colors ${
                            isSelected ? "bg-barber-blue/10" : ""
                          }`}
                          onClick={() => setSelectedMonthLabel(isSelected ? null : m.label)}
                        >
                          <span className={`text-[10px] font-mono block font-semibold ${isSelected ? "text-barber-blue" : "text-gray-500"}`}>
                            {m.label.split(" ")[0]}
                          </span>
                          <span className="text-[8px] font-mono text-gray-600 block">
                            {m.label.split(" ")[1]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Trending Services (Progress / Horizontal Bars) */}
              <div className="bg-dark-gray/20 border border-white/5 rounded-xl p-6">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-white">Trending Cuts</h3>
                    <p className="text-xs text-gray-500">
                      {selectedMonthLabel ? `Breakdown for ${selectedMonthLabel}` : "Breakdown by service selection"}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 bg-white/5 px-2 py-0.5 rounded font-mono">
                    Click to Filter
                  </span>
                </div>
                
                <div className="space-y-4 mt-6">
                  {trendingCuts.slice(0, 5).map((service, idx) => {
                    const percentage = totalServiceBookings > 0 
                      ? Math.round((service.count / totalServiceBookings) * 100) 
                      : 0;

                    const barWidth = Math.max((service.count / maxServiceCount) * 100, 2);
                    const color = segmentColors[idx % segmentColors.length];

                    const isSelected = selectedService === service.name;
                    const isAnySelected = selectedService !== null;
                    const opacity = isAnySelected ? (isSelected ? "1.0" : "0.35") : "1.0";

                    return (
                      <div 
                        key={idx} 
                        className="group cursor-pointer"
                        style={{ opacity }}
                        onClick={() => setSelectedService(isSelected ? null : service.name)}
                      >
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className={`font-semibold group-hover:text-white transition-colors duration-300 ${
                            isSelected ? "text-white" : "text-gray-300"
                          }`}>
                            {service.name} {isSelected && " ✓"}
                          </span>
                          <span className="text-gray-400 font-mono">
                            {service.count} <span className="text-gray-600">({percentage}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden relative border border-transparent group-hover:border-white/10 transition-colors">
                          <div
                            className="h-full rounded-full transition-all duration-500 group-hover:brightness-125"
                            style={{ 
                              width: `${barWidth}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {trendingCuts.length === 0 && (
                    <div className="text-center py-10 text-xs text-gray-600">
                      No service stats recorded in this selection.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Peak Hours density chart */}
            <div className="mt-8 bg-dark-gray/20 border border-white/5 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">Peak Barber Hours</h3>
              <p className="text-xs text-gray-500 mb-8">
                Hourly distribution of appointments 
                {selectedMonthLabel && ` in ${selectedMonthLabel}`}
                {selectedService && ` for "${selectedService}"`}
              </p>

              {/* Line chart SVG */}
              <div className="w-full h-56 relative">
                <svg className="w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
                  {/* Gradients */}
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guidlines */}
                  {[0, 0.5, 1].map((r, idx) => (
                    <line
                      key={idx}
                      x1="40"
                      y1={10 + r * 150}
                      x2="960"
                      y2={10 + r * 150}
                      stroke="rgba(255, 255, 255, 0.02)"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Build points path */}
                  {(() => {
                    const xSpace = 900 / (hourlyBuckets.length - 1);
                    const points = hourlyBuckets.map((h, idx) => {
                      const x = 50 + idx * xSpace;
                      const y = maxHourCount > 0 ? 160 - (h.count / maxHourCount) * 130 : 160;
                      return { x, y, label: h.label, count: h.count };
                    });

                    const linePath = points.map((p) => `${p.x},${p.y}`).join(" ");
                    const areaPath = `50,160 ${linePath} ${points[points.length - 1].x},160`;

                    return (
                      <g>
                        {/* Area Fill */}
                        <polygon points={areaPath} fill="url(#areaGrad)" />

                        {/* Connection Line */}
                        <polyline
                          points={linePath}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />

                        {/* Interactive circles */}
                        {points.map((p, idx) => (
                          <g key={idx} className="group cursor-pointer">
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="4"
                              fill="#10b981"
                              stroke="#000000"
                              strokeWidth="2"
                            />
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="8"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2"
                              className="opacity-0 group-hover:opacity-50 transition-opacity duration-300"
                            />
                            {/* Value tooltip */}
                            <rect
                              x={p.x - 20}
                              y={p.y - 28}
                              width="40"
                              height="18"
                              rx="4"
                              fill="#111827"
                              stroke="rgba(255, 255, 255, 0.1)"
                              strokeWidth="1"
                              className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            />
                            <text
                              x={p.x}
                              y={p.y - 16}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="10"
                              className="font-bold font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            >
                              {p.count}
                            </text>
                          </g>
                        ))}
                      </g>
                    );
                  })()}
                </svg>

                {/* X Axis Labels */}
                <div className="flex justify-between pl-[40px] pr-[30px] pt-2 border-t border-white/5">
                  {hourlyBuckets.map((h, idx) => (
                    <div key={idx} className="text-center w-[45px] text-[10px] font-mono text-gray-500 font-semibold">
                      {h.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </main>
      )}
    </>
  );
}
