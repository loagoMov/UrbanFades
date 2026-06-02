import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Urban Fades BW | Premium Barbershop Booking",
  description: "Experience the finest grooming services in BW. Book your next fresh fade today.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">
          {children}
        </div>
        <footer className="w-full py-4 text-center border-t border-white/5 bg-black">
          <p className="text-[10px] text-gray-600 tracking-widest uppercase">
            Developed and serviced by &copy; blanc Production
          </p>
        </footer>
      </body>
    </html>
  );
}
