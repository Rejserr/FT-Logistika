import { apiFetch, setToken, clearToken, getToken } from './api';
import type { LoginResponse, SessionInfo, DutyStatus } from '@/types';

export async function login(
  username: string,
  password: string,
  registrationPlate: string = '',
): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/driver/login', {
    method: 'POST',
    body: JSON.stringify({
      username,
      password,
      registration_plate: registrationPlate,
    }),
  });

  await setToken(data.access_token);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/driver/session/end', { method: 'POST' });
  } catch {
    // ignore errors on logout
  }
  await clearToken();
}

export async function getSession(): Promise<SessionInfo> {
  return apiFetch<SessionInfo>('/driver/session');
}

export async function getDutyStatus(): Promise<DutyStatus> {
  return apiFetch<DutyStatus>('/driver/duty');
}

export async function setDutyStatus(onDuty: boolean): Promise<DutyStatus> {
  return apiFetch<DutyStatus>(`/driver/duty?on_duty=${onDuty}`, {
    method: 'PUT',
  });
}

export async function checkAuth(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  try {
    const session = await getSession();
    return session.active;
  } catch {
    return false;
  }
}
