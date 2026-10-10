import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const databaseUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB_NAME ?? 'messbook';
const mongoClient = new MongoClient(databaseUri!);
const authDatabase = mongoClient.db(databaseName);

if (process.env.NODE_ENV === 'production' && !process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET must be set in production');
}

export const auth = betterAuth({
  database: mongodbAdapter(authDatabase),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      phone: { type: 'string', required: true },
    },
  },
  plugins: [expo()],
  trustedOrigins: (
    process.env.BETTER_AUTH_TRUSTED_ORIGINS ??
    'http://localhost:3000,http://localhost:8081,messbook://,exp://*'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
});
