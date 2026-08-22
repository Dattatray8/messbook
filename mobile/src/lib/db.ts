import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined");
}

let cached = (globalThis as typeof globalThis & {
  mongoose?: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}).mongoose;

if (!cached) {
  cached = {
    conn: null,
    promise: null,
  };

  (globalThis as typeof globalThis & {
    mongoose?: typeof cached;
  }).mongoose = cached;
}

export async function connectDB() {
  if (cached!.conn) {
    return cached!.conn;
  }

  if (!cached!.promise) {
    cached!.promise = mongoose.connect(MONGODB_URI!);
  }

  cached!.conn = await cached!.promise;

  return cached!.conn;
}