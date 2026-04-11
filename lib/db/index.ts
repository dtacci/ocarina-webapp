import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Connection string from Supabase
const connectionString = process.env.DATABASE_URL!;

// For Drizzle queries (pooled connection)
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
