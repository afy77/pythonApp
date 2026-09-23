export interface ProjectFile {
  name: string;
  path: string;
  language: 'python' | 'markdown' | 'ini' | 'text';
  description: string;
  badge: string;
  content: string;
}

export interface ItemEntity {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  created_at: string;
}

export type TransactionStatus = 'normal' | 'slow' | 'error';

export interface TraceStep {
  name: string;
  type: 'method' | 'sql' | 'sleep' | 'exception';
  durationMs: number;
  details?: string;
}

export interface ApmTransaction {
  id: string;
  timestamp: number;
  timeStr: string;
  method: string;
  endpoint: string;
  statusCode: number;
  responseTimeMs: number;
  status: TransactionStatus;
  sqlCount: number;
  errorDetail?: string;
  traceSteps: TraceStep[];
}
