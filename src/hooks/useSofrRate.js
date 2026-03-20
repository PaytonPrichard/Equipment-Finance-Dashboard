import { useState, useEffect } from 'react';
import { DEFAULT_SOFR } from '../utils/calculations';

const CACHE_KEY = 'efd_sofr_cache';
const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

function getCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt < CACHE_MAX_AGE_MS) return cached;
  } catch { /* ignore */ }
  return null;
}

function setCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, fetchedAt: Date.now() }));
  } catch { /* ignore */ }
}

export default function useSofrRate() {
  const [sofr, setSofr] = useState(() => {
    const cached = getCached();
    return cached ? cached.rate : DEFAULT_SOFR;
  });
  const [sofrDate, setSofrDate] = useState(() => {
    const cached = getCached();
    return cached ? cached.date : null;
  });
  const [sofrSource, setSofrSource] = useState(() => {
    const cached = getCached();
    return cached ? 'FRED (cached)' : 'Default';
  });

  useEffect(() => {
    const cached = getCached();
    if (cached) {
      setSofr(cached.rate);
      setSofrDate(cached.date);
      setSofrSource('FRED (cached)');
      return;
    }

    fetch('/api/sofr')
      .then((res) => {
        if (!res.ok) throw new Error(`Proxy API ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.rate == null) return;
        setSofr(data.rate);
        setSofrDate(data.date);
        setSofrSource('FRED (live)');
        setCache({ rate: data.rate, date: data.date });
      })
      .catch(() => {
        // Silently fall back to default
      });
  }, []);

  return { sofr, sofrDate, sofrSource };
}
