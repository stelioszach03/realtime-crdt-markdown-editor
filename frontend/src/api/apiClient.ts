/**
 * REST API client for the collaborative editor
 */

export interface User {
  id: string;
  username: string;
  email?: string;
  is_active: boolean;
  created_at: string;
}

export interface Document {
  id: string;
  name: string;
  owner_id: string;
  is_public: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DocumentWithContent extends Document {
  crdt_state?: string;
}

export interface DocumentList {
  documents: Document[];
  total: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface SignupData {
  username: string;
  password: string;
  email?: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ApiError {
  detail: string;
  error_code?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    // Use environment variable or default to backend port
    this.baseUrl = (import.meta as any).env?.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:53520`;
    
    // Load token from localStorage
    this.token = localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add authorization header if token exists
    if (this.token) {
      (headers as any).Authorization = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.detail);
      }

      // Handle empty responses (e.g., 204 No Content)
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  // Authentication methods
  async login(credentials: LoginCredentials): Promise<Token> {
    const token = await this.request<Token>('/api/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    this.setToken(token.access_token);
    return token;
  }

  async signup(userData: SignupData): Promise<User> {
    return this.request<User>('/api/users/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/api/users/me');
  }

  async createGuestToken(): Promise<Token> {
    const token = await this.request<Token>('/api/users/guest-token', {
      method: 'POST',
    });
    
    this.setToken(token.access_token);
    return token;
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  // Document methods
  async getDocuments(params?: {
    skip?: number;
    limit?: number;
    search?: string;
  }): Promise<DocumentList> {
    const searchParams = new URLSearchParams();
    
    if (params?.skip !== undefined) {
      searchParams.append('skip', params.skip.toString());
    }
    if (params?.limit !== undefined) {
      searchParams.append('limit', params.limit.toString());
    }
    if (params?.search) {
      searchParams.append('search', params.search);
    }

    const query = searchParams.toString();
    const endpoint = `/api/docs/${query ? `?${query}` : ''}`;
    
    return this.request<DocumentList>(endpoint);
  }

  async getDocument(documentId: string): Promise<DocumentWithContent> {
    return this.request<DocumentWithContent>(`/api/docs/${documentId}`);
  }

  async createDocument(data: { name: string; is_public?: boolean }): Promise<Document> {
    return this.request<Document>('/api/docs/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDocument(
    documentId: string,
    data: { name?: string; is_public?: boolean }
  ): Promise<Document> {
    return this.request<Document>(`/api/docs/${documentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.request<void>(`/api/docs/${documentId}`, {
      method: 'DELETE',
    });
  }

  // Collaborator methods
  async getCollaborators(documentId: string): Promise<any[]> {
    return this.request<any[]>(`/api/docs/${documentId}/collaborators`);
  }

  async addCollaborator(
    documentId: string,
    data: { user_id: string; permission?: string }
  ): Promise<any> {
    return this.request<any>(`/api/docs/${documentId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeCollaborator(documentId: string, userId: string): Promise<void> {
    await this.request<void>(`/api/docs/${documentId}/collaborators/${userId}`, {
      method: 'DELETE',
    });
  }

  // Session methods
  async getActiveSessions(documentId: string): Promise<any[]> {
    return this.request<any[]>(`/api/docs/${documentId}/sessions`);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; service: string }> {
    return this.request<{ status: string; service: string }>('/health');
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();

// Export the class for testing or custom instances
export { ApiClient };