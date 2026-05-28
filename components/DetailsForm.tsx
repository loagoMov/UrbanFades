"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface DetailsFormProps {
  onNext: (data: { fullName: string; whatsapp: string }) => void;
  onBack: () => void;
  initialData?: { fullName: string; whatsapp: string };
}

export default function DetailsForm({ onNext, onBack, initialData }: DetailsFormProps) {
  const [fullName, setFullName] = useState(initialData?.fullName || "");
  const [whatsapp, setWhatsapp] = useState(initialData?.whatsapp || "");
  const [errors, setErrors] = useState<{ fullName?: string; whatsapp?: string }>({});

  const validate = () => {
    const newErrors: { fullName?: string; whatsapp?: string } = {};
    
    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }

    // Botswana format: starting with 7 (mobile) or 267 (intl)
    const whatsappRegex = /^(7|267)\d{7,10}$/;
    if (!whatsapp.trim()) {
      newErrors.whatsapp = "WhatsApp number is required";
    } else if (!whatsappRegex.test(whatsapp.replace(/\s+/g, ""))) {
      newErrors.whatsapp = "Invalid Botswana format (must start with 7 or 267)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext({ fullName, whatsapp });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="mb-8 text-center">
        <h2 className="text-4xl font-bold text-white mb-2">Your Details</h2>
        <p className="text-gray-400">Tell us who you are</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-white mb-2 uppercase tracking-wider">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={`
              w-full px-4 py-3 bg-black border-2 transition-all duration-300 outline-none text-white
              ${errors.fullName ? 'border-sharp-red' : 'border-barber-blue/50 focus:border-barber-blue focus:shadow-blue-glow'}
            `}
            placeholder="John Doe"
          />
          {errors.fullName && (
            <p className="mt-1 text-sharp-red text-xs font-bold uppercase tracking-tighter">{errors.fullName}</p>
          )}
        </div>

        <div>
          <label htmlFor="whatsapp" className="block text-sm font-medium text-white mb-2 uppercase tracking-wider">
            WhatsApp Number
          </label>
          <input
            id="whatsapp"
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className={`
              w-full px-4 py-3 bg-black border-2 transition-all duration-300 outline-none text-white
              ${errors.whatsapp ? 'border-sharp-red' : 'border-barber-blue/50 focus:border-barber-blue focus:shadow-blue-glow'}
            `}
            placeholder="7XXXXXXX or 267XXXXXXX"
          />
          {errors.whatsapp && (
            <p className="mt-1 text-sharp-red text-xs font-bold uppercase tracking-tighter">{errors.whatsapp}</p>
          )}
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 px-6 py-4 bg-transparent border-2 border-gray-700 text-gray-400 font-bold uppercase tracking-widest hover:border-white hover:text-white transition-all duration-300"
          >
            Back
          </button>
          <button
            type="submit"
            className="flex-1 px-6 py-4 bg-barber-blue text-white font-bold uppercase tracking-widest hover:bg-barber-blue/80 shadow-blue-glow transition-all duration-300"
          >
            Next
          </button>
        </div>
      </form>
    </motion.div>
  );
}
