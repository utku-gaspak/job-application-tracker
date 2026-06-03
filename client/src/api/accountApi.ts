import axios from "axios";
import { finalUrl } from "../baseUrl";

interface AuthPayload {
  username: string;
  password: string;
}

interface RegisterPayload extends AuthPayload {
  email: string;
}

export interface AuthResponse {
  token: string;
  userName?: string;
  username?: string;
  email?: string;
}

const accountApi = axios.create({
  baseURL: `${finalUrl}/api/account`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const login = async (payload: AuthPayload) => {
  const response = await accountApi.post<AuthResponse>("/login", payload);
  return response.data;
};

export const logout = async (token: string) => {
  await accountApi.post(
    "/logout",
    null,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
};

export const register = async (payload: RegisterPayload) => {
  const response = await accountApi.post<AuthResponse>("/register", payload);
  return response.data;
};
