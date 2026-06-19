import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval,
  isBefore,
  startOfToday
} from "date-fns";

interface CalendarStepProps {
  onNext: (data: { date: Date; timeSlot: string; iso: string }) => void;
  onBack: () => void;
  initialData?: { date: Date; timeSlot: string; iso: string };
}

interface Slot {
  time: string;
  iso: string;
  available: boolean;
}

export default function CalendarStep({ onNext, onBack, initialData }: CalendarStepProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialData?.date || null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(initialData ? { time: initialData.timeSlot, iso: initialData.iso, available: true } : null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  const today = startOfToday();

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Gaborone' // Ensure consistent timezone
    }).replace(/^0/, ''); // Clean leading zeros (e.g. 09:00 AM -> 9:00 AM)
  };

  useEffect(() => {
    const fetchAvailability = async (date: Date) => {
      setLoading(true);
      try {
        const formattedDate = format(date, "yyyy-MM-dd");
        const response = await fetch(`/api/booking?date=${formattedDate}`);
        const data = await response.json();
        if (Array.isArray(data)) {
          setSlots(data);
        }
      } catch (error) {
        console.error("Failed to fetch slots:", error);
      } finally {
        setLoading(false);
      }
    };

    if (selectedDate) {
      fetchAvailability(selectedDate);
    }
  }, [selectedDate]);

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:text-barber-blue transition-colors"
        >
          &lt; Previous
        </button>
        <h3 className="text-2xl font-bold uppercase tracking-widest">
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <button 
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:text-barber-blue transition-colors"
        >
          Next &gt;
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map(day => (
          <div key={day} className="text-center text-xs font-bold text-gray-500 uppercase">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate,
    });

    return (
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isDisabled = isBefore(day, today) || !isCurrentMonth;
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <div
              key={idx}
              onClick={() => !isDisabled && setSelectedDate(day)}
              className={`
                aspect-square flex items-center justify-center cursor-pointer text-sm font-medium transition-all duration-300
                ${isDisabled ? 'text-gray-700 cursor-not-allowed' : 'hover:bg-barber-blue/20 hover:text-white'}
                ${isSelected ? 'bg-barber-blue text-white shadow-blue-glow' : ''}
                ${!isDisabled && !isSelected ? 'text-gray-300' : ''}
                ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : ''}
              `}
            >
              {format(day, "d")}
            </div>
          );
        })}
      </div>
    );
  };

  const handleNext = () => {
    if (selectedDate && selectedSlot) {
      onNext({ date: selectedDate, timeSlot: selectedSlot.time, iso: selectedSlot.iso });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-4xl mx-auto"
    >
      <div className="mb-12 text-center">
        <h2 className="text-4xl font-bold text-white mb-2">Select Date & Time</h2>
        <p className="text-gray-400">Find a slot that works for you</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 bg-dark-gray/50 p-8 rounded-lg border border-barber-blue/20">
        {/* Calendar Section */}
        <div>
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>

        {/* Time Slots Section */}
        <div className="flex flex-col min-h-[300px]">
          <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-wider text-center lg:text-left">
            Available Slots
          </h3>
          <AnimatePresence mode="wait">
            {!selectedDate ? (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex items-center justify-center text-gray-500 italic"
              >
                Please select a date first
              </motion.div>
            ) : loading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex items-center justify-center"
              >
                <div className="w-8 h-8 border-4 border-barber-blue border-t-transparent rounded-full animate-spin"></div>
              </motion.div>
            ) : (
              <motion.div 
                key="slots"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-3"
              >
                {slots.map(slot => (
                  <button
                    key={slot.iso}
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot)}
                    className={`
                      py-3 px-4 text-sm font-bold border-2 transition-all duration-300
                      ${!slot.available 
                        ? 'bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed line-through' 
                        : selectedSlot?.iso === slot.iso 
                          ? 'bg-black border-sharp-red text-sharp-red shadow-red-glow scale-105' 
                          : 'bg-black border-barber-blue/50 text-gray-400 hover:border-barber-blue hover:text-white'
                      }
                    `}
                  >
                    {slot.time}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-12">
        <button
          onClick={onBack}
          className="px-10 py-4 bg-transparent border-2 border-gray-700 text-gray-400 font-bold uppercase tracking-widest hover:border-white hover:text-white transition-all duration-300"
        >
          Back
        </button>
        <button
          disabled={!selectedDate || !selectedSlot}
          onClick={handleNext}
          className={`
            px-12 py-4 font-bold uppercase tracking-widest transition-all duration-300
            ${selectedDate && selectedSlot 
              ? 'bg-barber-blue text-white hover:bg-barber-blue/80 shadow-blue-glow' 
              : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
            }
          `}
        >
          Confirm Details
        </button>
      </div>
    </motion.div>
  );
}

