import { db, auth } from './config/firebase';

async function testFirebase() {
  try {
    console.log('Testing Firebase connection...');

    const collections = await db.listCollections();

    console.log('✅ Firebase Firestore connected successfully!');
    console.log(
      'Firestore collections:',
      collections.map((collection) => collection.id)
    );

    const users = await auth.listUsers(1);

    console.log('✅ Firebase Authentication connected successfully!');
    console.log(`Firebase Auth users found: ${users.users.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Firebase connection failed:');
    console.error(error);
    process.exit(1);
  }
}

testFirebase();