import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getApiBase(): string {
  if (!__DEV__) {
    return 'https://your-production-url.com/api'; // TODO: set production URL
  }

  // In dev: use the Expo host IP so both iOS & Android physical devices work
  const debuggerHost =
    Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    const host = debuggerHost.split(':')[0]; // strip port
    const url = `http://${host}:8000/api`;
    console.log('[API] Auto-detected base URL:', url);
    return url;
  }

  // Fallback per platform
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api';
  }
  return 'http://localhost:8000/api';
}

export const API_BASE = getApiBase();

let _token: string | null = null;

export async function getToken(): Promise<string | null> {
  if (_token) return _token;
  _token = await SecureStore.getItemAsync('access_token');
  return _token;
}

export async function setToken(token: string): Promise<void> {
  _token = token;
  await SecureStore.setItemAsync('access_token', token);
}

export async function clearToken(): Promise<void> {
  _token = null;
  await SecureStore.deleteItemAsync('access_token');
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${API_BASE}${path}`;
  const method = options.method ?? 'GET';

  console.log(`[API] ${method} ${url}`);
  if (options.body && typeof options.body === 'string') {
    console.log('[API] Body:', options.body);
  }

  const startTime = Date.now();

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[API] Response: ${res.status} (${elapsed}ms)`);

    if (res.status === 401) {
      console.log('[API] 401 Unauthorized - clearing token');
      await clearToken();
      throw new Error('UNAUTHORIZED');
    }

    if (!res.ok) {
      const errorBody = await res.text();
      console.log('[API] Error body:', errorBody);
      throw new Error(errorBody || `HTTP ${res.status}`);
    }

    const text = await res.text();
    if (!text) return {} as T;

    const parsed = JSON.parse(text) as T;
    console.log('[API] Success, response keys:', Object.keys(parsed as any));
    return parsed;
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.log(`[API] Request failed after ${elapsed}ms:`, error.message);
    throw error;
  }
}
