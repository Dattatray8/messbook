import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: "http://localhost:8081/api/auth",

  plugins: [
    expoClient({
      scheme: "messabook",
      storagePrefix: "messbook",
      storage: SecureStore,
    }),
  ],
});