import dns from 'node:dns';
import mongoose from 'mongoose';
import env from './env.js';
import '../models/index.js';

// Resolve DNS SRV query issues commonly encountered on Windows / local ISP DNS resolvers
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', ...dns.getServers()]);
} catch (dnsErr) {
  // If DNS reconfiguration fails in specific runtime environments, continue normally
}

export const connectDB = async () => {
  const mongoUri = env.MONGODB_URI;

  if (!mongoUri || mongoUri.includes('<username>') || mongoUri.includes('<password>')) {
    throw new Error('MONGODB_URI must be configured with a real database connection string');
  }
  if (env.NODE_ENV === 'production' && /^mongodb:\/\/(localhost|127\.0\.0\.1)/i.test(mongoUri)) {
    throw new Error('Production MONGODB_URI must not point to localhost');
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const conn = await mongoose.connect(mongoUri);
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      lastError = error;
      console.error(`❌ MongoDB Connection Attempt ${attempt}/3: ${error.message}`);
      if (error.code === 'ECONNREFUSED' && error.syscall === 'querySrv') {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
      }
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw lastError;
};

export default connectDB;
