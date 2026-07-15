'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useTransliterate
 * ────────────────
 * Takes an array of English strings (names) and returns a Map of
 * English → Bengali transliterations using Google Input Tools API.
 *
 * Results are cached globally so repeated names across re-renders
 * or component instances don't trigger redundant API calls.
 */

// Global cache persists across component instances and re-renders
const transliterationCache = new Map<string, string>();

// In-flight requests to avoid duplicate concurrent fetches
const pendingRequests = new Map<string, Promise<string>>();

async function transliterateSingle(text: string): Promise<string> {
  // Check cache
  if (transliterationCache.has(text)) {
    return transliterationCache.get(text)!;
  }

  // Check if request is already in flight
  if (pendingRequests.has(text)) {
    return pendingRequests.get(text)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(
        `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=bn-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&app=test`
      );
      const data = await res.json();

      if (data[0] === 'SUCCESS' && data[1]?.[0]?.[1]?.[0]) {
        const result = data[1][0][1][0] as string;
        transliterationCache.set(text, result);
        return result;
      }
    } catch {
      // Silently fail — return original text
    }
    // Cache failures too to avoid retrying
    transliterationCache.set(text, text);
    return text;
  })();

  pendingRequests.set(text, promise);
  const result = await promise;
  pendingRequests.delete(text);
  return result;
}

/**
 * Transliterate a full name by splitting into words, transliterating each,
 * and joining them back. This gives better results than sending the full string.
 */
async function transliterateName(fullName: string): Promise<string> {
  const words = fullName.trim().split(/\s+/);
  const transliteratedWords = await Promise.all(
    words.map((word) => transliterateSingle(word))
  );
  return transliteratedWords.join(' ');
}

export function useTransliterate(
  names: string[],
  enabled: boolean = true
): { transliterations: Map<string, string>; isLoading: boolean } {
  const [transliterations, setTransliterations] = useState<Map<string, string>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const prevNamesRef = useRef<string>('');

  const doTransliterate = useCallback(async (namesToTransliterate: string[]) => {
    if (namesToTransliterate.length === 0) return;

    setIsLoading(true);

    const results = new Map<string, string>();

    // Process in batches of 5 to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < namesToTransliterate.length; i += batchSize) {
      const batch = namesToTransliterate.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (name) => {
          const transliterated = await transliterateName(name);
          return [name, transliterated] as const;
        })
      );
      for (const [name, transliterated] of batchResults) {
        results.set(name, transliterated);
      }
    }

    setTransliterations((prev) => {
      const merged = new Map(prev);
      results.forEach((val, key) => merged.set(key, val));
      return merged;
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Deduplicate and filter out already-transliterated names
    const uniqueNames = [...new Set(names)].filter(
      (n) => n && !transliterations.has(n)
    );
    const namesKey = uniqueNames.sort().join('|');

    if (namesKey === prevNamesRef.current || uniqueNames.length === 0) return;
    prevNamesRef.current = namesKey;

    doTransliterate(uniqueNames);
  }, [names, enabled, transliterations, doTransliterate]);

  return { transliterations, isLoading };
}
