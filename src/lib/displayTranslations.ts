/**
 * displayTranslations.ts
 * ──────────────────────
 * Centralized translation dictionary for display screens (OPD, IPD, OT).
 * Contains all static UI labels in English and Bengali.
 */

export type Lang = 'en' | 'bn';

/* ── Bengali digit converter ────────────────────────────────────────────── */
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Convert any number or numeric string to Bengali digits: 123 → ১২৩ */
export function toBengaliNumeral(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[parseInt(d, 10)]);
}

/** Conditionally convert numerals based on current language */
export function localizeNumber(value: string | number, lang: Lang): string {
  return lang === 'bn' ? toBengaliNumeral(value) : String(value);
}

/** Format time for the given locale */
export function localizeTime(d: Date, lang: Lang): string {
  const locale = lang === 'bn' ? 'bn-IN' : 'en-IN';
  return d.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/** Format date for the given locale */
export function localizeDate(d: Date, lang: Lang): string {
  const locale = lang === 'bn' ? 'bn-IN' : 'en-IN';
  return d.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/* ── Translation dictionary ─────────────────────────────────────────────── */

export const translations = {
  en: {
    common: {
      hospitalName: 'Mikki Megha General Hospital',
      live: 'LIVE',
      room: 'Room',
      hours: 'Hours',
      token: 'Token',
      min: 'min',
      male: 'Male',
      female: 'Female',
      other: 'Other',
      yrs: 'yrs',
    },
    opd: {
      subtitle: 'Outpatient Department — Live Display',
      allDoctors: 'All Doctors',
    },
    doctorCard: {
      consulting: 'Consulting',
      upcoming: 'Upcoming',
      onBreak: 'On Break',
      completed: 'Completed',
      unavailable: 'Unavailable',
      sessionCompleted: 'Session completed for today',
      notAvailable: 'Not available today',
      department: 'Department',
      nowServing: 'Now Serving',
      nextToken: 'Next Token',
    },
    tokenCallout: {
      opdOverview: 'OPD Overview',
      treatedToday: 'Treated Today',
      ofTokens: 'of {n} tokens',
      activeNow: 'Active Now',
      consultations: 'consultations',
      inQueue: 'In Queue',
      patientsWaiting: 'patients waiting',
      avgWait: 'Avg Wait',
      perPatient: 'per patient',
      deptsActive: 'Depts Active',
      ofTotal: 'of {n} total',
      doctorsAvail: 'Doctors Avail.',
      ofToday: 'of {n} today',
      alsoRunning: 'Also Running',
      allOnScreen: 'All active doctors are visible on screen',
      rm: 'Rm',
    },
    ipd: {
      subtitle: 'IPD Patient Status Dashboard',
      wardUnit: 'Ward / Unit',
      occupiedCapacity: 'OCC / CAP',
      admittedPatients: 'Admitted Patients',
      admitted: 'Admitted',
      critical: 'Critical',
      occupancy: 'Occupancy',
      noPatients: 'No patients admitted',
      stable: 'Stable',
      monitoring: 'Monitoring',
    },
    ot: {
      subtitle: 'Operation Theatre — Live Schedule',
      otRoom: 'OT Room',
      status: 'Status',
      type: 'Type',
      procedure: 'Procedure',
      patient: 'Patient',
      surgeon: 'Surgeon',
      anaesthetist: 'Anaesthetist',
      time: 'Time',
      estDur: 'Est. Dur.',
      // Status labels
      inProgress: 'In Progress',
      preparing: 'Preparing',
      scheduled: 'Scheduled',
      delayed: 'Delayed',
      completed: 'Completed',
      cancelled: 'Cancelled',
      // Pill labels
      active: 'Active',
      done: 'Done',
    },
  },
  bn: {
    common: {
      hospitalName: 'মিক্কি মেঘা জেনারেল হাসপাতাল',
      live: 'লাইভ',
      room: 'কক্ষ',
      hours: 'সময়',
      token: 'টোকেন',
      min: 'মিনিট',
      male: 'পুরুষ',
      female: 'মহিলা',
      other: 'অন্যান্য',
      yrs: 'বছর',
    },
    opd: {
      subtitle: 'বহির্বিভাগ — লাইভ ডিসপ্লে',
      allDoctors: 'সকল ডাক্তার',
    },
    doctorCard: {
      consulting: 'পরামর্শ চলছে',
      upcoming: 'আসন্ন',
      onBreak: 'বিরতি',
      completed: 'সম্পন্ন',
      unavailable: 'অনুপলব্ধ',
      sessionCompleted: 'আজকের সেশন সম্পন্ন',
      notAvailable: 'আজ উপলব্ধ নয়',
      department: 'বিভাগ',
      nowServing: 'চলতি টোকেন',
      nextToken: 'পরবর্তী টোকেন',
    },
    tokenCallout: {
      opdOverview: 'ওপিডি সারসংক্ষেপ',
      treatedToday: 'আজ চিকিৎসিত',
      ofTokens: '{n} টোকেনের মধ্যে',
      activeNow: 'এখন সক্রিয়',
      consultations: 'পরামর্শ',
      inQueue: 'অপেক্ষায়',
      patientsWaiting: 'রোগী অপেক্ষায়',
      avgWait: 'গড় অপেক্ষা',
      perPatient: 'প্রতি রোগী',
      deptsActive: 'সক্রিয় বিভাগ',
      ofTotal: '{n} টির মধ্যে',
      doctorsAvail: 'ডাক্তার উপলব্ধ',
      ofToday: 'আজ {n} জনের মধ্যে',
      alsoRunning: 'আরো চলছে',
      allOnScreen: 'সকল সক্রিয় ডাক্তার পর্দায় দৃশ্যমান',
      rm: 'কক্ষ',
    },
    ipd: {
      subtitle: 'আন্তঃবিভাগ রোগীর অবস্থা',
      wardUnit: 'ওয়ার্ড / ইউনিট',
      occupiedCapacity: 'ভর্তি / ক্ষমতা',
      admittedPatients: 'ভর্তি রোগী',
      admitted: 'ভর্তি',
      critical: 'জটিল',
      occupancy: 'ভর্তি হার',
      noPatients: 'কোনো রোগী ভর্তি নেই',
      stable: 'স্থিতিশীল',
      monitoring: 'পর্যবেক্ষণ',
    },
    ot: {
      subtitle: 'অপারেশন থিয়েটার — লাইভ সূচি',
      otRoom: 'ওটি কক্ষ',
      status: 'অবস্থা',
      type: 'ধরন',
      procedure: 'পদ্ধতি',
      patient: 'রোগী',
      surgeon: 'সার্জন',
      anaesthetist: 'অ্যানেসথেটিস্ট',
      time: 'সময়',
      estDur: 'আনু. সময়কাল',
      // Status labels
      inProgress: 'চলমান',
      preparing: 'প্রস্তুতি',
      scheduled: 'নির্ধারিত',
      delayed: 'বিলম্বিত',
      completed: 'সম্পন্ন',
      cancelled: 'বাতিল',
      // Pill labels
      active: 'সক্রিয়',
      done: 'সম্পন্ন',
    },
  },
} as const;

/** Convenience type for getting a section of translations */
export type Translations = typeof translations;
