export type DoctorStatus = 'upcoming' | 'running' | 'break' | 'completed' | 'unavailable';

export interface Doctor {
  id: string;
  name: string;
  designation: string;
  roomNo: string;
  status: DoctorStatus;
  startTime: string;
  endTime: string;
  currentToken: number | null;
  totalTokens: number;
  avgWaitMinutes: number;
}

export interface Department {
  id: string;
  name: string;
  floor: string;
  /** Hex accent color for this department */
  color: string;
  doctors: Doctor[];
}

export interface OpdData {
  hospitalName: string;
  lastUpdated: string;
  announcements: string[];
  departments: Department[];
}

/** Doctor with department info merged in — used for the flat display grid */
export interface FlatDoctor extends Doctor {
  departmentId: string;
  departmentName: string;
  departmentFloor: string;
  departmentColor: string;
}

export interface OpdApiResponse {
  hospitalName: string;
  announcements: string[];
  doctors: FlatDoctor[];
  lastUpdated: string;
}

/* ─────────────────────── IPD Types ─────────────────────────────────────── */

export type PatientStatus = 'stable' | 'monitoring' | 'critical';

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F' | 'Other';
  admissionDate: string;  // "YYYY-MM-DD"
  bedNo: string;
  status: PatientStatus;
}

export interface Ward {
  id: string;
  name: string;          // "Male Ward", "Female Ward", etc.
  code: string;          // Short badge code e.g. "MW", "ICU"
  capacity: number;
  accentColor: string;   // Hex accent for badges / borders
  patients: Patient[];
}

export interface IpdData {
  hospitalName: string;
  lastUpdated: string;
  announcements: string[];
  wards: Ward[];
}

export interface IpdApiResponse {
  hospitalName: string;
  announcements: string[];
  wards: Ward[];
  lastUpdated: string;
}

/* ─────────────────────── OT Types ─────────────────────────────────────── */

export type OtStatus =
  | 'scheduled'   // booked, not yet started
  | 'preparing'   // patient being prepped
  | 'in-progress' // surgery ongoing
  | 'completed'   // procedure done
  | 'delayed'     // behind schedule
  | 'cancelled';  // cancelled for the day

export interface OtEntry {
  id: string;
  roomNo: string;           // "OT-1", "OT-2" ...
  type: string;             // "General Surgery", "Orthopaedic" ...
  procedureName: string;    // e.g. "Appendectomy"
  patientName: string;
  patientAge: number;
  patientGender: 'M' | 'F' | 'Other';
  doctor: string;           // Lead surgeon
  assistants: string[];     // Assisting doctors
  anaesthetist: string;
  scheduledTime: string;    // "09:00"
  estimatedDuration: number; // minutes
  status: OtStatus;
  notes: string;
}

export interface OtData {
  hospitalName: string;
  lastUpdated: string;
  announcements: string[];
  entries: OtEntry[];
}

export interface OtApiResponse {
  hospitalName: string;
  announcements: string[];
  entries: OtEntry[];
  lastUpdated: string;
}
