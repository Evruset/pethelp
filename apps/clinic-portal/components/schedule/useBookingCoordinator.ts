'use client';

import { useMemo, useRef } from 'react';
import { BookingRequestCoordinator } from '@/lib/api/booking-request-coordinator';

export function useBookingCoordinator(): BookingRequestCoordinator {
  const coordinatorRef = useRef<BookingRequestCoordinator | null>(null);

  return useMemo(() => {
    coordinatorRef.current ??= new BookingRequestCoordinator();
    return coordinatorRef.current;
  }, []);
}
