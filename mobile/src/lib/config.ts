export const API_URL =
    process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') ??
    'http://localhost:3000';