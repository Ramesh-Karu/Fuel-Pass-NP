export type Role = 'admin' | 'agent' | 'public' | 'manager' | 'distributor' | 'support';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: Role;
  station_id?: string;
  station_name?: string;
  status: 'active' | 'suspended' | 'pending';
  full_name?: string;
  nic?: string;
  address?: string;
  phone?: string;
  vehicle?: Vehicle;
}
export interface FuelStation {
  id: string;
  name: string;
  location: string;
  lat?: number;
  lng?: number;
  balance_petrol_92: number;
  balance_petrol_95: number;
  balance_diesel: number;
  balance_super_diesel: number;
  pump_count?: number;
  traffic_level?: number; // 0 to 100
}

export interface FuelPrice {
  petrol_92: number;
  petrol_95: number;
  diesel: number;
  super_diesel: number;
  last_updated: string;
}

export interface FuelDistribution {
  id: string;
  station_id: string;
  station_name?: string;
  fuel_type: string;
  amount: number;
  timestamp: string;
}

export interface Vehicle {
  id: string;
  id_prefix: string;
  id_number: string;
  type: VehicleType;
  fuel_limit: number;
  limit_period: 'day' | 'week' | 'month';
  user_id?: string;
}

export type VehicleType = 'Car' | 'Motorcycle / Bike' | 'Three-Wheeler / Auto Rickshaw' | 'Truck' | 'Bus' | 'Other';

export interface FuelTransaction {
  id: string;
  vehicle_id: string;
  agent_id: string;
  station_id: string;
  fuel_type: string;
  amount: number;
  timestamp: string;
  id_prefix?: string;
  id_number?: string;
  vehicle_type?: string;
  station_name?: string;
  agent_name?: string;
}

export interface AuditLog {
  id: string;
  transaction_id: string;
  user_id: string;
  username: string;
  action: string;
  old_value: string;
  new_value: string;
  timestamp: string;
  transaction_time: string;
}

export interface VehicleTypeLimit {
  type: VehicleType;
  fuel_limit: number;
  limit_period: 'day' | 'week' | 'month';
}

export type ComplaintStatus = 'Submitted' | 'Under Review' | 'Processing' | 'Resolved' | 'Rejected';

export interface ComplaintComment {
  user_id?: string;
  text: string;
  role: 'admin' | 'user';
  timestamp: string;
}

export interface Complaint {
  id: string;
  complaint_id: string; // Unique ID like CMP-12345
  name?: string;
  email_phone: string;
  nic: string;
  type: string;
  station_location?: string;
  incident_date: string;
  description: string;
  evidence_urls?: string[];
  status: ComplaintStatus;
  timestamp: string;
  user_id?: string; // If logged in
  comments: ComplaintComment[];
}

export interface Invoice {
  id: string;
  invoice_id: string;
  customer_reference: string;
  station_or_distributor_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: string;
  date: string;
  notes?: string;
  status: 'Paid' | 'Pending' | 'Cancelled';
  station_id: string;
}

export interface Income {
  id: string;
  income_id: string;
  category: string;
  amount: number;
  payment_method: string;
  date: string;
  description: string;
  station_id: string;
  station_reference?: string;
}

export interface Expense {
  id: string;
  expense_id: string;
  category: string;
  amount: number;
  date: string;
  payment_method: string;
  description: string;
  receipt_url?: string;
  station_id: string;
}

export interface StockReduction {
  id: string;
  station_id: string;
  fuel_type: string;
  amount: number;
  timestamp: string;
  manager_id: string;
}
