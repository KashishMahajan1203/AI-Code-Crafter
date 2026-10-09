import mongoose from "mongoose";
import dns from "dns";

const connectDB = async (mongoURI) => {
  try {
    // Use Cloudflare + Google DNS for MongoDB SRV resolution
    const dnsServers = (
      process.env.MONGODB_DNS_SERVERS ||
      "1.1.1.1,8.8.8.8"
    )
      .split(",")
      .map((server) => server.trim())
      .filter(Boolean);

    dns.setServers(dnsServers);

    const connection = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });

    // Make sure schema indexes exist (autoIndex is off in production).
    await Promise.all(
      Object.values(mongoose.models).map((model) => model.createIndexes())
    );

    console.log(
      `🍃 MongoDB connected: ${connection.connection.host}`
    );
  } catch (error) {
    console.error("❌ MongoDB connection failed:");
    console.error(error.message);

    process.exit(1);
  }
};

export default connectDB;
