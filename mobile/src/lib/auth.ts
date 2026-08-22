import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { expo } from "@better-auth/expo";
import { authDb } from "./auth-db";

export const auth = betterAuth({
  database: mongodbAdapter(authDb),

  secret: process.env.BETTER_AUTH_SECRET,

  baseURL: process.env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
  },

  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: true,
      },
    },
  },

  plugins: [expo()],

  trustedOrigins: ["messbook://"],
});
