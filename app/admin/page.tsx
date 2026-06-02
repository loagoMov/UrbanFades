"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AuthRedirect from "@/components/AuthRedirect";
import AdminDashboard from "@/components/AdminDashboard";

export default function AdminPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
           const idToken = await user.getIdToken();
           const res = await fetch("/api/admin/bookings", {
             headers: { Authorization: `Bearer ${idToken}` },
           });
           if (res.ok) {
             const data = await res.json();
             setBookings(data.bookings || []);
           } else {
             console.error("Failed to fetch bookings", res.status);
           }
        } catch (err) {
          console.error("Error fetching bookings", err);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <>
      <AuthRedirect />
      {loading ? (
        <div className="flex items-center justify-center min-h-screen bg-black text-white">
          <div className="animate-pulse">Loading...</div>
        </div>
      ) : (
        <main className="min-h-screen bg-black text-white p-6 md:p-12 relative overflow-hidden">
          <AdminDashboard initialBookings={bookings} />
        </main>
      )}
    </>
  );
}
