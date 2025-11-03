export type UUID = string;
export type ISODate = string;

export interface ReceiptAsset {
  id: UUID;
  employeeId: UUID | null;
  sha256: string;
  mime: string;
  filename: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: ISODate;
  ocrStatus: 'pending' | 'done' | 'error';
  ocrModel?: string;
}

export interface LineItem {
  description: string;
  amount: number;
}

export interface ReceiptExtractedData {
  merchant: string | null;
  amountTotal: number | null;
  amountTax?: number | null;
  currency?: string | null;
  items?: LineItem[];
  date: ISODate | null;
  location?: { city?: string; state?: string; country?: string };
  paymentMethod?: string | null;
  category?: string | null;
  invoiceNumber?: string | null;
}

export interface PolicyFinding {
  code: string;
  severity: 'info' | 'warn' | 'block';
  message: string;
  evidence?: string;
}

export interface ExpenseDraft {
  id: UUID;
  receiptId: UUID;
  employeeId?: UUID | null;
  functionalTeamCode?: string | null;
  tripId?: UUID | null;
  extraction: ReceiptExtractedData;
  validation: PolicyFinding[];
  status:
    | 'needs-info'
    | 'valid'
    | 'flagged'
    | 'submitted'
    | 'proposed'
    | 'approved'
    | 'rejected';
  glAccount?: string | null;
  businessCategory?: string | null;
  aiConfidence?: number | null;
  aiLabels?: string[] | null;
  aiAllocations?: AISplitAllocation[] | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface PolicyRule {
  code: string;
  description: string;
  appliesTo: { category?: string; city?: string };
  limit?: number;
  requires?: { receipt?: boolean; managerApproval?: boolean };
}

export interface Employee {
  id: UUID;
  name: string;
  email?: string | null;
  teamCode?: string | null;
  createdAt: ISODate;
}

export interface FunctionalTeam {
  code: string;
  name: string;
  description?: string | null;
  createdAt: ISODate;
}

export interface Trip {
  id: UUID;
  name: string;
  startDate?: ISODate | null;
  endDate?: ISODate | null;
  city?: string | null;
  country?: string | null;
  createdAt: ISODate;
}

export interface AISplitAllocation {
  glAccount: string;
  amount?: number;
  percent?: number;
  notes?: string;
}

