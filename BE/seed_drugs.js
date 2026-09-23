import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import { Drug } from './src/models/drug.model.js';
import { User } from './src/models/user.model.js';

const seedDrugs = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find any hospital_admin to get a hospitalId
    const admin = await User.findOne({ role: 'hospital_admin' });
    if (!admin || !admin.hospitalId) {
      console.error('No hospital_admin with a hospitalId found!');
      process.exit(1);
    }

    const hospitalId = admin.hospitalId;
    console.log('Using hospitalId:', hospitalId);

    // Dummy drugs
    const drugs = [
      {
        hospitalId,
        name: 'Paracetamol',
        activeIngredient: 'Paracetamol 500mg',
        category: 'pain_reliever',
        manufacturer: 'Dược Hậu Giang',
        dosageInstructions: '1 viên/lần, 2-3 lần/ngày sau ăn',
        stock: { quantity: 1500, unit: 'Viên', minStock: 200 },
        price: 1500,
        expiryDate: new Date('2027-12-31'),
        interactions: ['Rượu', 'Isoniazid'],
      },
      {
        hospitalId,
        name: 'Depakine Chrono 500mg',
        activeIngredient: 'Sodium Valproate',
        category: 'anticonvulsant',
        manufacturer: 'Sanofi',
        dosageInstructions: '1 viên/lần, 1-2 lần/ngày. Uống nguyên viên',
        stock: { quantity: 300, unit: 'Viên', minStock: 50 },
        price: 4500,
        expiryDate: new Date('2028-06-30'),
        interactions: ['Lamotrigine', 'Carbamazepine'],
      },
      {
        hospitalId,
        name: 'Tegretol 200mg',
        activeIngredient: 'Carbamazepine',
        category: 'anticonvulsant',
        manufacturer: 'Novartis',
        dosageInstructions: '1 viên/lần, 2 lần/ngày',
        stock: { quantity: 120, unit: 'Viên', minStock: 200 }, // Dưới ngưỡng cảnh báo
        price: 3200,
        expiryDate: new Date('2026-10-15'),
        interactions: ['Valproate', 'Thuốc tránh thai'],
      },
      {
        hospitalId,
        name: 'Medrol 16mg',
        activeIngredient: 'Methylprednisolone',
        category: 'corticosteroid',
        manufacturer: 'Pfizer',
        dosageInstructions: '1 viên/ngày vào buổi sáng',
        stock: { quantity: 500, unit: 'Viên', minStock: 100 },
        price: 8000,
        expiryDate: new Date('2027-01-20'),
        interactions: ['NSAIDs', 'Ketoconazole'],
      },
      {
        hospitalId,
        name: 'Temozolomide (Temodal) 100mg',
        activeIngredient: 'Temozolomide',
        category: 'chemotherapy',
        manufacturer: 'MSD / Schering-Plough',
        dosageInstructions: 'Uống 150mg/m2/ngày khi đói x 5 ngày chu kỳ 28 ngày (Phác đồ Stupp u thần kinh đệm)',
        stock: { quantity: 180, unit: 'Viên', minStock: 30 },
        price: 750000,
        expiryDate: new Date('2028-12-31'),
        interactions: ['Valproate'],
      },
      {
        hospitalId,
        name: 'Temozolomide (Temodal) 250mg',
        activeIngredient: 'Temozolomide',
        category: 'chemotherapy',
        manufacturer: 'MSD / Schering-Plough',
        dosageInstructions: 'Uống 200mg/m2/ngày khi đói x 5 ngày chu kỳ duy trì',
        stock: { quantity: 90, unit: 'Viên', minStock: 20 },
        price: 1850000,
        expiryDate: new Date('2028-12-31'),
        interactions: ['Valproate'],
      },
      {
        hospitalId,
        name: 'Mannitol 20% (250ml)',
        activeIngredient: 'Mannitol',
        category: 'anti_edema',
        manufacturer: 'B.Braun',
        dosageInstructions: 'Truyền tĩnh mạch nhanh 250ml trong 30-60 phút hạ áp lực nội sọ cấp cứu',
        stock: { quantity: 240, unit: 'Chai', minStock: 50 },
        price: 85000,
        expiryDate: new Date('2027-06-30'),
        interactions: [],
      },
      {
        hospitalId,
        name: 'Dexamethasone 4mg',
        activeIngredient: 'Dexamethasone',
        category: 'corticosteroid',
        manufacturer: 'Dược Hậu Giang',
        dosageInstructions: '1-2 viên/lần x 2 lần/ngày sáng chiều sau ăn chống phù não quanh u',
        stock: { quantity: 800, unit: 'Viên', minStock: 150 },
        price: 3500,
        expiryDate: new Date('2027-09-30'),
        interactions: ['NSAIDs'],
      },
      {
        hospitalId,
        name: 'Keppra 500mg',
        activeIngredient: 'Levetiracetam',
        category: 'anticonvulsant',
        manufacturer: 'UCB',
        dosageInstructions: '1 viên/lần, 2 lần/ngày chống động kinh do u não',
        stock: { quantity: 450, unit: 'Viên', minStock: 100 },
        price: 12000,
        expiryDate: new Date('2028-03-10'),
        interactions: [],
      }
    ];

    try {
      await Drug.collection.dropIndex("name_1");
    } catch (_) {}

    await Drug.deleteMany({});
    console.log('Cleared old drugs across collection.');

    await Drug.insertMany(drugs);
    console.log(`Successfully seeded ${drugs.length} specialized neuro-oncology drugs.`);

  } catch (error) {
    console.error('Error seeding drugs:', error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
};

seedDrugs();
