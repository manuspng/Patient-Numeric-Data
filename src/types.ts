/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  DAUO = "DAUO",
  HOSPITAL_USER = "HOSPITAL_USER"
}

export interface Hospital {
  id: string;
  name: string;
  code: string;
  type: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  stream?: string;
  location?: string;
  block?: string;
  district?: string;
  incharge?: string;
  category?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  hospitalId?: string; // Scoped strictly if HOSPITAL_USER
  phone: string;
  isWhitelisted: boolean;
  password?: string;
  designation?: string;
  contact?: string;
}

export interface PatientMatrixLog {
  opd_male_new: number;
  opd_male_old: number;
  opd_female_new: number;
  opd_female_old: number;
  opd_child_new: number;
  opd_child_old: number;
  opd_elderly_new: number;
  opd_elderly_old: number;
  ipd_admissions: number;
  ipd_male_new: number;
  ipd_male_old: number;
  ipd_female_new: number;
  ipd_female_old: number;
  ipd_child_new: number;
  ipd_child_old: number;
  ipd_bed_occupancy_percentage: number;
  panchkarma_male: number;
  panchkarma_female: number;
  panchkarma_child: number;
  panchkarma_elderly: number;
  levy_charges: number; // in INR
  aadhaar_seeded_count: number;
  mobile_seeded_count: number;
}

export interface InvestigationsLabLog {
  hemoglobin: number;
  blood_sugar: number;
  urine_sugar: number;
  urine_albumin: number;
  malaria: number;
  dengue: number;
  typhoid: number;
  hepatitis_a: number;
  hepatitis_b: number;
  hepatitis_c: number;
  pregnancy_tests: number;
}

export interface InventoryItemLog {
  kit_type: string; // e.g., "Hemoglobin Strips", "Blood Sugar Strips", "Pregnancy Kits", "Urine Strips", "Malaria Kits"
  opening_balance: number;
  received_qty: number;
  used_qty: number;
  defective_qty: number;
  closing_balance: number; // Opening + Received - Used - Defective
  low_stock_threshold: number;
}

export interface OutreachCampLog {
  village_location: string;
  beneficiaries_male: number;
  beneficiaries_female: number;
  beneficiaries_child: number;
  beneficiaries_total: number;
  medicine_distributed_count: number;
  ncd_screenings: number | string;
  ayurvidya_sessions: number; // count of sessions conducted
}

export interface DiseaseOPDLog {
  diseaseId: string;
  diseaseName: string;
  opd_male_new: number;
  opd_male_old: number;
  opd_female_new: number;
  opd_female_old: number;
  opd_child_new: number;
  opd_child_old: number;
  opd_elderly_new: number;
  opd_elderly_old: number;
}

export interface DailyReport {
  id: string;
  hospitalId: string;
  recordDate: string; // YYYY-MM-DD
  submittedAt: string; // ISO String
  submittedBy: string; // User email
  patientMatrix: PatientMatrixLog;
  investigationsLab: InvestigationsLabLog;
  inventory: InventoryItemLog[];
  camps: OutreachCampLog[];
  isLocked: boolean;
  anomalyConfirmed: boolean;
  anomalyFlags: string[]; // List of fields flagged as anomalous (e.g. ["patientMatrix.opd_male_new"])
  diseaseLogs?: DiseaseOPDLog[];
  customFieldsData?: Record<string, string | number>;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: string; // e.g., "CREATE", "UPDATE", "LOCK", "WHITELIST", "BULK_UPLOAD"
  tableName: string; // e.g., "DailyReport", "Hospital", "User"
  recordId: string;
  details: string;
  timestamp: string; // ISO String
}

export interface DataLockSetting {
  id: string;
  hospitalId: string;
  recordDate: string; // YYYY-MM-DD
  isLocked: boolean;
  lockedBy: string;
  lockedAt: string;
}

// Master Table items for dynamic selection
export interface MasterDisease {
  id: string;
  name: string;
  category: string;
}

export interface MasterTest {
  id: string;
  name: string;
  normalRange: string;
}

export interface MasterKit {
  id: string;
  name: string;
  unit: string;
  defaultThreshold: number;
}

export interface CellMapping {
  sheetName: string;
  cellRef: string; // e.g. "B5"
  systemField: string; // e.g. "opd_male_new" or custom field ID
}

export interface CustomReportField {
  id: string;
  name: string;
  type: "number" | "text";
  category: "opd" | "ipd" | "panchkarma" | "lab" | "camp" | "general";
  defaultValue?: string;
}

export interface CustomReportTemplate {
  id: string;
  name: string;
  fileName: string;
  fileBase64: string; // Base64 encoded Excel template (.xlsx / .csv)
  mappings: CellMapping[];
  customFields: CustomReportField[];
  createdAt: string;
}

export interface RegistrationRequest {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  hospitalId?: string;
  phone: string;
  password?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
}


