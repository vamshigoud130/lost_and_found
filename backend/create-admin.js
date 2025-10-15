const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lost_and_found';

async function createAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const email = process.argv[2] || 'admin@lostandfound.com';
    const password = process.argv[3] || 'admin123';
    const name = process.argv[4] || 'Admin User';
    const mobileNumber = process.argv[5] || '+1234567890';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      process.exit(0);
    }

    // Create admin user
    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await User.create({
      email,
      passwordHash,
      name,
      mobileNumber,
      role: 'admin'
    });

    console.log('Admin user created successfully!');
    console.log('Email:', admin.email);
    console.log('Name:', admin.name);
    console.log('Mobile:', admin.mobileNumber);
    console.log('Role:', admin.role);
    console.log('Password:', password);
    console.log('\nYou can now login with these credentials.');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();
