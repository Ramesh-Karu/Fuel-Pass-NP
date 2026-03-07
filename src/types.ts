export type Role = 'admin' | 'agent' | 'public' | 'manager';

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
  balance_petrol_92: number;
  balance_petrol_95: number;
  balance_diesel: number;
  balance_super_diesel: number;
  pump_count?: number;
  traffic_level?: number; // 0 to 100
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
