"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import AuthRedirect from "@/components/AuthRedirect";
import AdminDashboard from "@/components/AdminDashboard";

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

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const { data: bookings = [], error, isValidating, mutate } = useSWR(
    user ? "/api/admin/bookings" : null,
    fetcher,
    {
      refreshInterval: 30 * 60 * 1000, // 30 minutes
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const initialLoading = authLoading || (user && !bookings && !error);

  return (
    <>
      <AuthRedirect />
      {initialLoading ? (
        <div className="flex items-center justify-center min-h-screen bg-black text-white">
          <div className="animate-pulse">Loading...</div>
        </div>
      ) : (
        <main className="min-h-screen bg-black text-white p-6 md:p-12 relative overflow-hidden">
          <AdminDashboard 
            initialBookings={bookings} 
            onRefresh={mutate}
            isRefreshing={isValidating}
          />
        </main>
      )}
    </>
  );
}
