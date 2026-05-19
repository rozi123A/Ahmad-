const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if MONGODB_URI is configured
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️ MONGODB_URI is not configured. Database features will not work.');
      return null;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.warn('⚠️ The app will continue running, but database features may not work.');
    console.warn('Please verify your MONGODB_URI environment variable on Render.');
    // Return null instead of exiting to allow the app to start
    return null;
  }
};

module.exports = connectDB;
