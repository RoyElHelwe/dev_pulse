import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import axios from 'axios';

@Injectable()
export class AuthProxyService {
  private readonly authServiceUrl: string;

  constructor(@Inject('AUTH_SERVICE') private authClient: ClientProxy) {
    this.authServiceUrl = process.env.AUTH_SERVICE_URL!;
  }

  // HTTP proxy methods for REST endpoints
  async register(email: string, password: string, name?: string) {
    const response = await axios.post(`${this.authServiceUrl}/auth/register`, {
      email,
      password,
      name,
    });
    return response.data;
  }

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
    cookies?: any,
  ) {
    const response = await axios.post(
      `${this.authServiceUrl}/auth/login`,
      { email, password },
      {
        headers: {
          'X-Forwarded-For': ipAddress,
          'User-Agent': userAgent,
        },
        withCredentials: true,
      },
    );
    return {
      ...response.data,
      cookies: response.headers['set-cookie'],
    };
  }

  async verify2FA(
    userId: string,
    token: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const response = await axios.post(
      `${this.authServiceUrl}/auth/2fa/verify`,
      { userId, token },
      {
        headers: {
          'X-Forwarded-For': ipAddress,
          'User-Agent': userAgent,
        },
        withCredentials: true,
      },
    );
    return {
      ...response.data,
      cookies: response.headers['set-cookie'],
    };
  }

  async refreshToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const response = await axios.post(
      `${this.authServiceUrl}/auth/refresh`,
      {},
      {
        headers: {
          'X-Forwarded-For': ipAddress,
          'User-Agent': userAgent,
          Cookie: `refresh_token=${refreshToken}`,
        },
        withCredentials: true,
      },
    );
    return {
      ...response.data,
      cookies: response.headers['set-cookie'],
    };
  }

  async setup2FA(sessionToken: string) {
    const response = await axios.post(
      `${this.authServiceUrl}/auth/2fa/setup`,
      {},
      {
        headers: {
          Cookie: `session_token=${sessionToken}`,
        },
        withCredentials: true,
      },
    );
    return response.data;
  }

  async enable2FA(sessionToken: string, token: string) {
    const response = await axios.post(
      `${this.authServiceUrl}/auth/2fa/enable`,
      { token },
      {
        headers: {
          Cookie: `session_token=${sessionToken}`,
        },
        withCredentials: true,
      },
    );
    return response.data;
  }

  async disable2FA(sessionToken: string, token: string) {
    const response = await axios.post(
      `${this.authServiceUrl}/auth/2fa/disable`,
      { token },
      {
        headers: {
          Cookie: `session_token=${sessionToken}`,
        },
        withCredentials: true,
      },
    );
    return response.data;
  }

  async getCurrentUser(sessionToken: string) {
    const response = await axios.get(`${this.authServiceUrl}/auth/me`, {
      headers: {
        Cookie: `session_token=${sessionToken}`,
      },
      withCredentials: true,
    });
    return response.data;
  }

  async getSession(sessionToken: string) {
    const response = await axios.get(`${this.authServiceUrl}/auth/session`, {
      headers: {
        Cookie: `session_token=${sessionToken}`,
      },
      withCredentials: true,
    });
    return response.data;
  }

  async getUserSessions(sessionToken: string) {
    const response = await axios.get(`${this.authServiceUrl}/auth/sessions`, {
      headers: {
        Cookie: `session_token=${sessionToken}`,
      },
      withCredentials: true,
    });
    return response.data;
  }

  async revokeSession(sessionToken: string, sessionId: string) {
    const response = await axios.delete(
      `${this.authServiceUrl}/auth/session/${sessionId}`,
      {
        headers: {
          Cookie: `session_token=${sessionToken}`,
        },
        data: { sessionId },
        withCredentials: true,
      },
    );
    return response.data;
  }

  async revokeAllSessions(sessionToken: string) {
    const response = await axios.delete(
      `${this.authServiceUrl}/auth/sessions`,
      {
        headers: {
          Cookie: `session_token=${sessionToken}`,
        },
        withCredentials: true,
      },
    );
    return response.data;
  }

  async logout(sessionToken: string, refreshToken: string) {
    const response = await axios.post(
      `${this.authServiceUrl}/auth/logout`,
      {},
      {
        headers: {
          Cookie: `session_token=${sessionToken}; refresh_token=${refreshToken}`,
        },
        withCredentials: true,
      },
    );
    return response.data;
  }

  // NATS message pattern methods for inter-service communication
  async validateSession(sessionToken: string) {
    return firstValueFrom(
      this.authClient.send({ cmd: 'validate_session' }, { sessionToken }),
    );
  }

  async getUserById(userId: string) {
    return firstValueFrom(
      this.authClient.send({ cmd: 'get_user_by_id' }, { userId }),
    );
  }

  async forgotPassword(email: string) {
    const response = await axios.post(
      `${this.authServiceUrl}/auth/forgot-password`,
      { email },
    );
    return response.data;
  }

  async verifyResetToken(token: string) {
    const response = await axios.get(
      `${this.authServiceUrl}/auth/verify-reset-token/${token}`,
    );
    return response.data;
  }

  async resetPassword(token: string, newPassword: string) {
    const response = await axios.post(
      `${this.authServiceUrl}/auth/reset-password`,
      { token, newPassword },
    );
    return response.data;
  }
}
