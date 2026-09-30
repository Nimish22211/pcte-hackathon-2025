const { db, ensureUser } = require('./helpers');
const { createDefaultAdmin } = require('./init-db');

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days) => new Date(Date.now() - days * DAY);

// Demo accounts. Admins appoint officials; officials choose servicemen from their own department.
const USERS = [
  { key: 'citizen', name: 'John Citizen', email: 'john@example.com', password: 'password123', phone: '+1234567890', role: 'citizen' },
  { key: 'publicWorks', name: 'Jane Official', email: 'jane@city.gov', password: 'password123', phone: '+1234567891', role: 'official', department: 'public_works' },
  { key: 'traffic', name: 'Bob Traffic', email: 'bob@city.gov', password: 'password123', phone: '+1234567892', role: 'official', department: 'traffic' },
  { key: 'parks', name: 'Alice Parks', email: 'alice@city.gov', password: 'password123', phone: '+1234567893', role: 'official', department: 'parks' },
  { key: 'samPW', name: 'Sam Serviceman', email: 'sam@city.gov', password: 'password123', phone: '+1234567894', role: 'serviceman', department: 'public_works' },
  { key: 'tinaTraffic', name: 'Tina Serviceman', email: 'tina@city.gov', password: 'password123', phone: '+1234567895', role: 'serviceman', department: 'traffic' },
  { key: 'peteParks', name: 'Pete Serviceman', email: 'pete@city.gov', password: 'password123', phone: '+1234567896', role: 'serviceman', department: 'parks' }
];

// Every issue has a fixed id so re-running the seed updates the same documents instead of duplicating them.
// `history` entries are [status, updatedByKey, notes, daysAgo].
const ISSUES = [
  {
    id: 'seed-issue-1',
    latitude: 30.9174630, longitude: 75.8524301,
    address: 'Chaura Bazar Road, Ludhiana, Punjab 141008, India',
    category: 'pothole', title: 'Large pothole on Chaura Bazar Road',
    description: 'There is a large pothole on Chaura Bazar Road that is causing damage to vehicles. It has been getting worse over the past few weeks.',
    severity: 4,
    photos: [{ url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', public_id: 'sample-pothole-1' }],
    status: 'reported', createdDaysAgo: 2,
    history: [['reported', 'citizen', null, 2]]
  },
  {
    // Assigned to an official by the admin, waiting for the official to choose a serviceman
    id: 'seed-issue-2',
    latitude: 30.8884442, longitude: 75.8403959,
    address: 'Model Town Road, Model Town, Ludhiana, Punjab 141002, India',
    category: 'streetlight', title: 'Broken streetlight in Model Town',
    description: 'The streetlight on Model Town Road has been out for over a week. It makes the area very dark at night.',
    severity: 3,
    photos: [{ url: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800', public_id: 'sample-streetlight-1' }],
    status: 'acknowledged', official: 'publicWorks', createdDaysAgo: 9,
    history: [
      ['reported', 'citizen', null, 9],
      ['acknowledged', 'admin', 'Assigned to official: Jane Official', 8]
    ]
  },
  {
    // Serviceman chosen and working
    id: 'seed-issue-3',
    latitude: 30.8918940, longitude: 75.8183896,
    address: 'Sarabha Nagar, Ludhiana, Punjab 141001, India',
    category: 'graffiti', title: 'Graffiti on public building in Sarabha Nagar',
    description: 'There is extensive graffiti on the wall of a public building in Sarabha Nagar. It appeared over the weekend.',
    severity: 2,
    photos: [{ url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800', public_id: 'sample-graffiti-1' }],
    status: 'in_progress', official: 'parks', serviceman: 'peteParks', createdDaysAgo: 16,
    history: [
      ['reported', 'citizen', null, 16],
      ['acknowledged', 'admin', 'Assigned to official: Alice Parks', 15],
      ['acknowledged', 'parks', 'Assigned to serviceman: Pete Serviceman', 15],
      ['in_progress', 'peteParks', 'Work started on issue', 14]
    ]
  },
  {
    // Work finished by the serviceman, waiting for the official to verify
    id: 'seed-issue-4',
    latitude: 30.9040094, longitude: 75.8004222,
    address: 'Near Punjab Agricultural University, Ferozepur Road, Ludhiana, Punjab 141004, India',
    category: 'waste', title: 'Overflowing trash cans near PAU',
    description: 'The trash cans near Punjab Agricultural University on Ferozepur Road are overflowing and garbage is scattered around the area.',
    severity: 3,
    photos: [{ url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', public_id: 'sample-waste-1' }],
    status: 'resolved', official: 'publicWorks', serviceman: 'samPW', createdDaysAgo: 30, resolvedDaysAgo: 3,
    history: [
      ['reported', 'citizen', null, 30],
      ['acknowledged', 'admin', 'Assigned to official: Jane Official', 29],
      ['acknowledged', 'publicWorks', 'Assigned to serviceman: Sam Serviceman', 29],
      ['in_progress', 'samPW', 'Work started on issue', 27],
      ['resolved', 'samPW', 'Bins emptied and area cleaned', 3]
    ]
  },
  {
    id: 'seed-issue-5',
    latitude: 30.9128024, longitude: 75.8481637,
    address: 'Near Ludhiana Railway Station, Ludhiana, Punjab 141008, India',
    category: 'sewage', title: 'Sewage overflow near Railway Station',
    description: 'Sewage is overflowing onto the road near Ludhiana Railway Station. The smell is very strong and pedestrians are affected.',
    severity: 5,
    photos: [{ url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', public_id: 'sample-sewage-1' }],
    status: 'reported', createdDaysAgo: 1,
    history: [['reported', 'citizen', null, 1]]
  },
  {
    id: 'seed-issue-6',
    latitude: 30.8941267, longitude: 75.8295059,
    address: 'Pakhowal Road, Gurudev Nagar, Ludhiana, Punjab 141001, India',
    category: 'road', title: 'Cracked road surface on Pakhowal Road',
    description: 'The road surface on Pakhowal Road is cracked and uneven, which is dangerous for children and cyclists.',
    severity: 4,
    photos: [{ url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', public_id: 'sample-road-1' }],
    status: 'in_progress', official: 'traffic', serviceman: 'tinaTraffic', createdDaysAgo: 5,
    history: [
      ['reported', 'citizen', null, 5],
      ['acknowledged', 'admin', 'Assigned to official: Bob Traffic', 4],
      ['acknowledged', 'traffic', 'Assigned to serviceman: Tina Serviceman', 4],
      ['in_progress', 'tinaTraffic', 'Work started on issue', 1]
    ]
  },
  {
    // Completed and verified
    id: 'seed-issue-7',
    latitude: 30.8715878, longitude: 75.8457591,
    address: 'Dugri, Ludhiana, Punjab, India',
    category: 'sewage', title: 'Blocked drain causing waterlogging in Dugri',
    description: 'A blocked drain in Dugri is causing waterlogging on the street after every rain.',
    severity: 3,
    photos: [{ url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', public_id: 'sample-drain-1' }],
    status: 'verified', official: 'publicWorks', serviceman: 'samPW', createdDaysAgo: 40, resolvedDaysAgo: 34,
    history: [
      ['reported', 'citizen', null, 40],
      ['acknowledged', 'admin', 'Assigned to official: Jane Official', 39],
      ['acknowledged', 'publicWorks', 'Assigned to serviceman: Sam Serviceman', 39],
      ['in_progress', 'samPW', 'Work started on issue', 37],
      ['resolved', 'samPW', 'Drain cleared', 34],
      ['verified', 'publicWorks', 'Checked on site, drain is flowing', 33]
    ]
  }
];

const seedDatabase = async () => {
  console.log('🌱 Seeding Firebase with sample data...');

  const ids = { admin: await createDefaultAdmin() };

  for (const { key, ...userData } of USERS) {
    const { id, created } = await ensureUser(userData, { sync: true });
    ids[key] = id;
    console.log(created ? `✅ Created user: ${userData.name} (${userData.email})` : `👤 Updated user: ${userData.email}`);
  }

  for (const issue of ISSUES) {
    const ref = db.collection('issues').doc(issue.id);
    const lastHistory = issue.history[issue.history.length - 1];

    // Remove history left over from earlier seed runs
    const oldHistory = await ref.collection('status_history').get();

    const batch = db.batch();
    oldHistory.docs.forEach((doc) => batch.delete(doc.ref));

    batch.set(ref, {
      latitude: issue.latitude,
      longitude: issue.longitude,
      address: issue.address,
      category: issue.category,
      title: issue.title,
      description: issue.description,
      severity: issue.severity,
      photos: issue.photos,
      reported_by: ids.citizen,
      assigned_to: issue.official ? ids[issue.official] : null,
      serviceman_id: issue.serviceman ? ids[issue.serviceman] : null,
      status: issue.status,
      internal_notes: null,
      resolved_at: issue.resolvedDaysAgo ? daysAgo(issue.resolvedDaysAgo) : null,
      created_at: daysAgo(issue.createdDaysAgo),
      updated_at: daysAgo(lastHistory[3])
    });

    issue.history.forEach(([status, updatedByKey, notes, ago], index) => {
      batch.set(ref.collection('status_history').doc(`seed-history-${index + 1}`), {
        status,
        updated_by: ids[updatedByKey],
        notes,
        created_at: new Date(daysAgo(ago).getTime() + index * 1000) // keeps same-day entries in order
      });
    });

    await batch.commit();
    console.log(`✅ Seeded issue: ${issue.title}`);
  }

  console.log('🎉 Database seeded successfully!');
  console.log('\n📊 Sample Data:');
  console.log(`👥 Users: ${USERS.length + 1}`);
  console.log(`📋 Issues: ${ISSUES.length}`);
  console.log('\n🔑 Login Credentials:');
  console.log('Admin:      admin@civic-platform.com / admin123');
  console.log('Citizen:    john@example.com / password123');
  console.log('Officials:  jane@city.gov (public works), bob@city.gov (traffic), alice@city.gov (parks) / password123');
  console.log('Servicemen: sam@city.gov (public works), tina@city.gov (traffic), pete@city.gov (parks) / password123');
};

seedDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  });
