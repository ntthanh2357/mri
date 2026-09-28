import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://group5:12345@mri.kwwgmt6.mongodb.net/neuro';

async function renewHospitals() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const db = mongoose.connection.db;
  const result = await db.collection('hospitals').updateMany(
    {},
    {
      $set: {
        subscriptionExpiresAt: new Date('2028-12-31T23:59:59.000Z'),
        subscriptionStatus: 'active',
        isActive: true
      }
    }
  );

  console.log(`✅ Đã cập nhật thành công ${result.modifiedCount} bệnh viện!`);

  const updatedHospitals = await db.collection('hospitals').find(
    {},
    { projection: { name: 1, code: 1, subscriptionExpiresAt: 1, subscriptionStatus: 1, isActive: 1 } }
  ).toArray();

  console.log('Danh sách bệnh viện sau cập nhật:');
  console.log(JSON.stringify(updatedHospitals, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

renewHospitals().catch((err) => {
  console.error('Lỗi gia hạn bệnh viện:', err);
  process.exit(1);
});
