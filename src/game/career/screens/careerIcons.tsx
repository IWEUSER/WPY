export function EarningsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2v9.6M9.4 9.1c.6-.7 1.5-1.1 2.6-1.1 1.6 0 2.6.8 2.6 1.9 0 2.6-5.2 1.4-5.2 4 0 1.1 1 1.9 2.6 1.9 1.2 0 2.1-.4 2.7-1.1" strokeLinecap="round" />
    </svg>
  );
}

export function WageIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="6.5" width="17" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M6.2 12h.2M17.6 12h.2" strokeLinecap="round" />
    </svg>
  );
}

export function TrophyIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M8 5h8v4.2a4 4 0 0 1-8 0V5Z" />
      <path d="M8 7.2H5.8A2.8 2.8 0 0 0 8.6 10M16 7.2h2.2A2.8 2.8 0 0 1 15.4 10" strokeLinecap="round" />
      <path d="M12 13.2V16M9 19h6M10.2 16h3.6" strokeLinecap="round" />
    </svg>
  );
}

export function AwardIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="9.2" r="4.2" />
      <path d="M12 7.4v3.6M10.4 9.2h3.2" strokeLinecap="round" />
      <path d="M9.6 13.4 8 20l4-1.8L16 20l-1.6-6.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RecordsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M7 4.8h10a2 2 0 0 1 2 2V19l-3.2-1.4L12 19l-3.8-1.4L5 19V6.8a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
      <path d="M9 8.4h6M9 11.2h6M9 14h3.6" strokeLinecap="round" />
    </svg>
  );
}
