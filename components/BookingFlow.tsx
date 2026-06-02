"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import LightRays from "./LightRays";
import SplitText from "./SplitText";
import BackgroundSlideshow from "./BackgroundSlideshow";

import DetailsForm from "./DetailsForm";
import CalendarStep from "./CalendarStep";

import { supabase } from "@/lib/supabaseClient";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

const SERVICE_META: Record<string, { category: "Regular Fade Cuts" | "Tinted Cuts"; image: string; description: string }> = {
  "Regular Fade": {
    category: "Regular Fade Cuts",
    image: "",
    description: "Classic clean blend, precision tapered around the ears and neck."
  },
  "Regular Fade & Fibre": {
    category: "Regular Fade Cuts",
    image: "/images/cut_and_fibre.jpeg",
    description: "Precision fade enhanced with natural hair fibers for a fuller hairline."
  },
  "Regular Fade & Tint": {
    category: "Tinted Cuts",
    image: "/images/cut_and_tint.jpeg",
    description: "Sharp fade combined with high-contrast hair color tint enhancement."
  },
  "Cut & Blonde": {
    category: "Tinted Cuts",
    image: "/images/cut_and_blonde.jpeg",
    description: "Premium hair scissor cut and dynamic full blonde coloring."
  }
};

export default function BookingFlow() {
  const [services, setServices] = useState<Service[]>([]);
  const [step, setStep] = useState<"landing" | "service" | "designs" | "details" | "calendar" | "summary" | "success">("landing");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [wantsLineDesigns, setWantsLineDesigns] = useState<boolean>(false);
  const [customerData, setCustomerData] = useState<{ fullName: string; whatsapp: string }>({
    fullName: "",
    whatsapp: ""
  });
  const [bookingDetails, setBookingDetails] = useState<{ date: Date; timeSlot: string; iso: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  const selectedService = services.find(s => s.id === selectedServiceId);

  const handleStartBooking = async () => {
    setStep("service");
    setIsLoadingServices(true);
    try {
      const { data, error } = await supabase.from('services').select('*').order('created_at', { ascending: true });
      if (data) {
        setServices(data);
      }
    } catch (err) {
      console.error("Error loading services:", err);
    } finally {
      setIsLoadingServices(false);
    }
  };
  
  const handleServiceNext = () => {
    if (selectedServiceId) setStep("designs");
  };

  const handleDesignsNext = () => {
    setStep("details");
  };

  const handleDetailsNext = (data: { fullName: string; whatsapp: string }) => {
    setCustomerData(data);
    setStep("calendar");
  };

  const handleCalendarNext = (data: { date: Date; timeSlot: string; iso: string }) => {
    setBookingDetails(data);
    setStep("summary");
  };

  const handleConfirmBooking = async () => {
    if (!selectedService || !bookingDetails) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerData.fullName,
          phone: customerData.whatsapp,
          service: selectedService.name,
          startTime: bookingDetails.iso,
          hasLineDesigns: wantsLineDesigns,
        }),
      });

      if (response.ok) {
        setStep("success");
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("Failed to create booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToService = () => setStep("service");
  const handleBackToDesigns = () => setStep("designs");
  const handleBackToDetails = () => setStep("details");
  const handleBackToLanding = () => setStep("landing");

  const regularCuts = services.filter(s => SERVICE_META[s.name]?.category === "Regular Fade Cuts");
  const tintedCuts = services.filter(s => SERVICE_META[s.name]?.category === "Tinted Cuts");

  const renderSkeletonCard = () => {
    return (
      <div className="bg-dark-gray/40 border border-barber-blue/10 rounded-xl overflow-hidden flex flex-col h-full animate-pulse">
        <div className="h-48 w-full bg-gray-800/30 relative" />
        <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <div className="h-6 w-1/2 bg-gray-800/40 rounded" />
              <div className="h-6 w-16 bg-gray-800/40 rounded" />
            </div>
            <div className="h-4 w-5/6 bg-gray-800/20 rounded" />
            <div className="h-4 w-4/6 bg-gray-800/20 rounded" />
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-gray-800/20 mt-auto">
            <div className="h-4 w-20 bg-gray-800/40 rounded" />
            <div className="h-5 w-5 rounded-full bg-gray-800/40" />
          </div>
        </div>
      </div>
    );
  };

  const renderServiceCard = (service: Service) => {
    const meta = SERVICE_META[service.name] || {
      image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=600&auto=format&fit=crop",
      description: "Premium grooming service."
    };
    const isSelected = selectedServiceId === service.id;

    return (
      <motion.div
        key={service.id}
        whileHover={{ scale: 1.02, y: -4 }}
        onClick={() => setSelectedServiceId(service.id)}
        className={`
          cursor-pointer bg-dark-gray rounded-xl overflow-hidden transition-all duration-300 flex flex-col h-full
          ${isSelected 
            ? 'border-4 border-barber-blue scale-[1.02] shadow-[0_0_20px_rgba(0,71,171,0.5)]' 
            : 'border border-barber-blue/20 hover:border-sharp-red'
          }
        `}
      >
        <div className="h-48 w-full relative overflow-hidden bg-gray-950 flex items-center justify-center">
          {meta.image ? (
            <img 
              src={meta.image} 
              alt={service.name} 
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-barber-blue/20 to-sharp-red/10 flex items-center justify-center">
              <span className="text-4xl filter drop-shadow-[0_0_10px_rgba(0,71,171,0.5)]">✂️</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-gray via-transparent to-transparent" />
        </div>
        <div className="p-6 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-xl font-bold text-white tracking-tight">{service.name}</h4>
              <span className="text-white font-mono font-black text-lg bg-barber-blue/20 border border-barber-blue/30 px-3 py-0.5 rounded">
                P{service.price}
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              {meta.description}
            </p>
          </div>
          <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-800">
            <span className="text-gray-500 text-xs uppercase tracking-widest font-semibold flex items-center gap-1">
              ⏱ {service.duration_minutes} Mins
            </span>
            <div className={`
              w-5 h-5 rounded-full border-2 flex items-center justify-center
              ${isSelected ? 'bg-barber-blue border-barber-blue' : 'border-gray-600'}
            `}>
              {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <BackgroundSlideshow />
      <LightRays
        raysOrigin="top-center"
        raysColor="#2563EB"
        raysSpeed={1.5}
        lightSpread={0.8}
        rayLength={1.2}
        followMouse={true}
        mouseInfluence={0.1}
        noiseAmount={0.1}
        distortion={0.05}
        className="custom-rays"
      />
      
      <div className="z-10 w-full flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
        {step === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="flex flex-wrap justify-center items-center gap-3 mb-8">
              <SplitText
                text="Welcome to"
                className="text-5xl md:text-7xl font-bold text-white tracking-tighter"
                delay={50}
                duration={0.8}
                tag="h1"
              />
              <SplitText
                text="Urban Fades BW"
                className="text-5xl md:text-7xl font-bold text-barber-blue tracking-tighter"
                delay={80}
                duration={0.8}
                tag="h1"
              />
            </div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
              whileHover={{ 
                borderColor: "#DC2626", 
                color: "#DC2626",
                transition: { duration: 0.2 } 
              }}
              onClick={handleStartBooking}
              className="px-8 py-4 bg-black border-4 border-barber-blue text-white text-xl font-bold uppercase tracking-widest transition-colors duration-300"
            >
              Make a Booking
            </motion.button>
          </motion.div>
        )}

        {step === "service" && (
          <motion.div
            key="service"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-5xl"
          >
            <div className="mb-12 text-center">
              <h2 className="text-4xl font-bold text-white mb-2">Select Service</h2>
              <p className="text-gray-400">Choose your style from our premium menu</p>
            </div>

            <div className="space-y-12 mb-12">
              {isLoadingServices ? (
                <>
                  <div>
                    <h3 className="text-2xl font-black text-white mb-6 uppercase tracking-wider border-b border-barber-blue/30 pb-2 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-barber-blue inline-block"></span>
                      Regular Fade Cuts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i}>{renderSkeletonCard()}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white mb-6 uppercase tracking-wider border-b border-barber-blue/30 pb-2 flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-sharp-red inline-block"></span>
                      Tinted Cuts
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i}>{renderSkeletonCard()}</div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {regularCuts.length > 0 && (
                    <div>
                      <h3 className="text-2xl font-black text-white mb-6 uppercase tracking-wider border-b border-barber-blue/30 pb-2 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-barber-blue inline-block"></span>
                        Regular Fade Cuts
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {regularCuts.map((service) => renderServiceCard(service))}
                      </div>
                    </div>
                  )}

                  {tintedCuts.length > 0 && (
                    <div>
                      <h3 className="text-2xl font-black text-white mb-6 uppercase tracking-wider border-b border-barber-blue/30 pb-2 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-sharp-red inline-block"></span>
                        Tinted Cuts
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tintedCuts.map((service) => renderServiceCard(service))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={handleBackToLanding}
                className="px-8 py-4 border-2 border-gray-700 text-gray-400 font-bold uppercase tracking-widest hover:border-white hover:text-white transition-all duration-300"
              >
                Back
              </button>
              <motion.button
                disabled={!selectedServiceId}
                onClick={handleServiceNext}
                whileHover={selectedServiceId ? { scale: 1.05 } : {}}
                whileTap={selectedServiceId ? { scale: 0.95 } : {}}
                className={`
                  px-12 py-4 text-xl font-bold uppercase tracking-widest transition-all duration-300
                  ${selectedServiceId 
                    ? 'bg-barber-blue text-white hover:bg-barber-blue/80 cursor-pointer shadow-[0_0_15px_rgba(0,71,171,0.5)]' 
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  }
                `}
              >
                Next
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === "designs" && (
          <motion.div
            key="designs"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-4xl"
          >
            <div className="mb-12 text-center">
              <h2 className="text-4xl font-bold text-white mb-2">Elevate Your Cut</h2>
              <p className="text-gray-400">Add custom precision line designs crafted by our master barbers</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="grid grid-cols-2 gap-4 bg-dark-gray/40 border border-barber-blue/10 p-4 rounded-2xl">
                <div className="h-64 rounded-xl overflow-hidden relative border border-gray-800">
                  <img src="/images/line_designs.jpeg" alt="Line Design Sample 1" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-2 left-2 text-[10px] text-gray-300 uppercase tracking-widest font-bold">Sample Style A</span>
                </div>
                <div className="h-64 rounded-xl overflow-hidden relative border border-gray-800">
                  <img src="/images/line_designs1.jpeg" alt="Line Design Sample 2" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-2 left-2 text-[10px] text-gray-300 uppercase tracking-widest font-bold">Sample Style B</span>
                </div>
              </div>

              <div className="flex flex-col justify-center space-y-6">
                <div 
                  onClick={() => setWantsLineDesigns(false)}
                  className={`
                    p-6 rounded-xl cursor-pointer border-2 transition-all duration-300 flex flex-col justify-between
                    ${!wantsLineDesigns 
                      ? 'bg-barber-blue/10 border-barber-blue shadow-[0_0_15px_rgba(0,71,171,0.2)]' 
                      : 'bg-dark-gray border-gray-800 hover:border-gray-700'
                    }
                  `}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xl font-bold text-white">No, just the basic cut</h4>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!wantsLineDesigns ? 'bg-barber-blue border-barber-blue' : 'border-gray-600'}`}>
                      {!wantsLineDesigns && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm">Keep it classic with your selected haircut alone.</p>
                </div>

                <div 
                  onClick={() => setWantsLineDesigns(true)}
                  className={`
                    p-6 rounded-xl cursor-pointer border-2 transition-all duration-300 flex flex-col justify-between
                    ${wantsLineDesigns 
                      ? 'bg-sharp-red/10 border-sharp-red shadow-[0_0_15px_rgba(220,38,38,0.2)]' 
                      : 'bg-dark-gray border-gray-800 hover:border-gray-700'
                    }
                  `}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xl font-bold text-white">Yes, add line designs</h4>
                      <span className="text-xs bg-sharp-red text-white font-mono font-bold px-2 py-0.5 rounded">FROM P20</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${wantsLineDesigns ? 'bg-sharp-red border-sharp-red' : 'border-gray-600'}`}>
                      {wantsLineDesigns && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm">Upgrade with sharp, customized precision razor line designs (+P20).</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={handleBackToService}
                className="px-8 py-4 border-2 border-gray-700 text-gray-400 font-bold uppercase tracking-widest hover:border-white hover:text-white transition-all duration-300"
              >
                Back
              </button>
              <motion.button
                onClick={handleDesignsNext}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-12 py-4 text-xl font-bold uppercase tracking-widest bg-barber-blue text-white hover:bg-barber-blue/80 cursor-pointer shadow-[0_0_15px_rgba(0,71,171,0.5)] transition-all duration-300"
              >
                Next
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === "details" && (
          <DetailsForm 
            onNext={handleDetailsNext} 
            onBack={handleBackToDesigns} 
            initialData={customerData}
          />
        )}

        {step === "calendar" && (
          <CalendarStep 
            onNext={handleCalendarNext} 
            onBack={handleBackToDetails} 
            initialData={bookingDetails || undefined}
          />
        )}

        {step === "summary" && bookingDetails && selectedService && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-dark-gray p-10 border-2 border-barber-blue shadow-blue-glow text-center"
          >
            <h2 className="text-4xl font-bold text-white mb-8 tracking-tighter uppercase">Confirm Booking</h2>
            
            <div className="space-y-6 mb-10 text-left border-y border-gray-800 py-6">
              <div>
                <p className="text-gray-500 uppercase text-xs tracking-widest mb-1">Service</p>
                <div className="flex justify-between items-center">
                  <p className="text-white text-xl font-bold">{selectedService.name}</p>
                  <p className="text-white font-mono">P{selectedService.price}</p>
                </div>
                {wantsLineDesigns && (
                  <div className="flex justify-between items-center mt-2 text-sm text-gray-400">
                    <p>⚡ Precision Line Designs</p>
                    <p className="font-mono">+P20</p>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-800">
                <p className="text-gray-500 uppercase text-xs tracking-widest">Total Price</p>
                <p className="text-2xl font-black text-white font-mono">P{selectedService.price + (wantsLineDesigns ? 20 : 0)}</p>
              </div>
              <div className="flex justify-between">
                <div>
                  <p className="text-gray-500 uppercase text-xs tracking-widest mb-1">Date</p>
                  <p className="text-white font-bold">{format(bookingDetails.date, "PPP")}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 uppercase text-xs tracking-widest mb-1">Time</p>
                  <p className="text-barber-blue font-bold">{bookingDetails.timeSlot}</p>
                </div>
              </div>
              <div>
                <p className="text-gray-500 uppercase text-xs tracking-widest mb-1">Customer</p>
                <p className="text-white font-bold">{customerData.fullName}</p>
                <p className="text-gray-400 text-sm">{customerData.whatsapp}</p>
              </div>
            </div>

            <button 
              disabled={isSubmitting}
              onClick={handleConfirmBooking}
              className={`
                w-full py-4 font-bold uppercase tracking-widest transition-all duration-300
                ${isSubmitting 
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                  : 'bg-barber-blue text-white hover:bg-barber-blue/80'
                }
              `}
            >
              {isSubmitting ? "Finalizing..." : "Confirm & Book"}
            </button>
            
            {!isSubmitting && (
              <button 
                onClick={() => setStep("calendar")}
                className="mt-4 text-gray-500 hover:text-white transition-colors"
              >
                Change Appointment
              </button>
            )}
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-24 h-24 bg-barber-blue rounded-full flex items-center justify-center mx-auto mb-8 shadow-blue-glow">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-5xl font-bold text-white mb-4 tracking-tighter">YOU&apos;RE ALL SET!</h2>
            <p className="text-gray-400 text-xl mb-4">Your appointment has been confirmed and added to our calendar.</p>
            <p className="text-gray-500 text-sm mb-12 max-w-md mx-auto italic">
              A confirmation message will be sent to your WhatsApp, Thank you.
            </p>
            <p className="text-sharp-red font-bold uppercase tracking-widest mb-12 animate-pulse">See you at Urban Fades BW!</p>
            
            <button 
              onClick={() => window.location.reload()}
              className="px-12 py-4 border-2 border-barber-blue text-white font-bold uppercase tracking-widest hover:bg-barber-blue transition-all duration-300"
            >
              Return Home
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}



