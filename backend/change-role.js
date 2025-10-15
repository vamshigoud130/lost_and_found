const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lost_and_found';

async function changeUserRole() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const email = process.argv[2];
    const newRole = process.argv[3] || 'admin';

    if (!email) {
      console.log('Usage: node change-role.js <email> [role]');
      console.log('Example: node change-role.js user@example.com admin');
      process.exit(1);
    }

    // Find the user
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found with email:', email);
      process.exit(1);
    }

    console.log('Current user details:');
    console.log('Email:', user.email);
    console.log('Name:', user.name);
    console.log('Current Role:', user.role);

    // Update the role
    user.role = newRole;
    await user.save();

    console.log('\n✅ User role updated successfully!');
    console.log('Email:', user.email);
    console.log('Name:', user.name);
    console.log('New Role:', user.role);

  } catch (error) {
    console.error('Error updating user role:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

changeUserRole();
