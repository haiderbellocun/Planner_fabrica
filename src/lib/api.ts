// Centralized API client for making authenticated requests to the backend
// Base URL must be set via VITE_API_URL (e.g. in .env.production or .env)

export const apiBaseUrl = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'taskflow_token';

interface ApiError {
  error: string;
  details?: any;
}

class ApiClient {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem(TOKEN_KEY);
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.error || 'Request failed');
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, data?: any): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async patch<T>(path: string, data?: any): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, data?: any): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    return this.handleResponse<T>(response);
  }
}

// Export singleton instance
export const api = new ApiClient();
export default api;
