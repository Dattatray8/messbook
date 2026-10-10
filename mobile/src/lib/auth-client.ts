import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({ scheme: 'messbook', storagePrefix: 'messbook', storage: SecureStore }),
    inferAdditionalFields({ user: { phone: { type: 'string', required: true } } }),
  ],
});
