import { create } from "axios";

const baseURL = process.env.EXPO_PUBLIC_GO_API_URL;

export const goApiClient = create({
  baseURL,
  timeout: 10_000,
  headers: { Accept: "application/json" },
  // Keep the same browser cookie/redirect behavior as the original request.
  adapter: "fetch",
  withCredentials: false,
  fetchOptions: { credentials: "omit", redirect: "error" },
});

goApiClient.interceptors.request.use((config) => {
  if (!config.baseURL?.trim()) {
    throw new Error("Add EXPO_PUBLIC_GO_API_URL before using the Go API.");
  }
  return config;
});
