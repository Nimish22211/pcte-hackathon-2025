const { ensureUser } = require('./helpers');

// Firestore collections are created automatically on first write, so the only setup
// needed is the default admin account (Firebase Auth + Firestore profile).
const createDefaultAdmin = async () => {
  console.log('👤 Creating default admin user...');

  const { id, created } = await ensureUser({
    name: 'System Admin',
    email: 'admin@civic-platform.com',
    password: 'admin123',
    role: 'admin',
    department: 'public_works'
  });

  if (created) {
    console.log('✅ Default admin user created');
    console.log('📧 Email: admin@civic-platform.com');
    console.log('🔑 Password: admin123');
  } else {
    console.log('✅ Admin user already exists');
  }

  return id;
};

const main = async () => {
  try {
    await createDefaultAdmin();
    console.log('🎉 Firebase setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Setup failed:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { createDefaultAdmin };
