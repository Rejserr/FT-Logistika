export interface UserInfo {
  id: number;
  username: string;
  full_name: string;
  role: string;
  warehouse_id: number | null;
}

export interface RouteSummary {
  route_count: number;
  stop_count: number;
  total_km: number;
  total_min: number;
}

export interface LoginResponse {
  message: string;
  access_token: string;
  token_type: string;
  session_id: number;
  vozilo_id: number | null;
  vozilo_found: boolean;
  force_password_change: boolean;
  user: UserInfo;
  summary: RouteSummary;
}

export interface RouteStop {
  id: number;
  redoslijed: number;
  nalog_uid: string;
  partner_naziv: string | null;
  adresa: string | null;
  mjesto: string | null;
  lat: number | null;
  lng: number | null;
  eta: string | null;
  status: 'PENDING' | 'ARRIVED' | 'DELIVERED' | 'FAILED' | 'SKIPPED';
}

export interface DriverRoute {
  id: number;
  datum: string | null;
  raspored: string | null;
  status: string | null;
  distance_km: number | null;
  duration_min: number | null;
  vozilo_oznaka: string | null;
  vozilo_registracija: string | null;
  stops: RouteStop[];
  polyline: number[][] | null;
}

export interface SessionInfo {
  active: boolean;
  session_id?: number;
  vozilo_id?: number | null;
  registration_plate?: string | null;
  on_duty?: boolean;
  started_at?: string | null;
}

export interface DutyStatus {
  on_duty: boolean;
  active_session: boolean;
  session_id?: number;
}

export type NavApp = 'google' | 'waze' | 'tomtom';
export type AppTheme = 'light' | 'dark' | 'system';
export type AppLanguage = 'hr' | 'en';
