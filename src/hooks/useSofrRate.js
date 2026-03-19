import { useState, useEffect } from 'react';
import { DEFAULT_SOFR } from '../utils/calculations';

const FRED_API_KEY = process.env.REACT_APP_FRED_API_KEY;
const SOFR_SERIES = 'SOFR';
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
    if (!FRED_API_KEY) return;

    const cached = getCached();
    if (cached) {
      setSofr(cached.rate);
      setSofrDate(cached.date);
      setSofrSource('FRED (cached)');
      return;
    }

    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${SOFR_SERIES}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=5`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`FRED API ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const obs = data.observations?.find((o) => o.value !== '.');
        if (!obs) return;
        const rate = parseFloat(obs.value) / 100;
        if (isNaN(rate) || rate <= 0 || rate > 0.20) return; // sanity check
        setSofr(rate);
        setSofrDate(obs.date);
        setSofrSource('FRED (live)');
        setCache({ rate, date: obs.date });
      })
      .catch(() => {
        // Silently fall back to default
      });
  }, []);

  return { sofr, sofrDate, sofrSource };
}
