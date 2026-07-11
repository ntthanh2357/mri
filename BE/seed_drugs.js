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
        name: 'Keppra 500mg',
        activeIngredient: 'Levetiracetam',
        category: 'anticonvulsant',
        manufacturer: 'UCB',
        dosageInstructions: '1 viên/lần, 2 lần/ngày',
        stock: { quantity: 450, unit: 'Viên', minStock: 100 },
        price: 12000,
        expiryDate: new Date('2028-03-10'),
        interactions: [],
      }
    ];

    await Drug.deleteMany({ hospitalId });
    console.log('Cleared old drugs for this hospital.');

    await Drug.insertMany(drugs);
    console.log('Successfully seeded 5 drugs.');

  } catch (error) {
    console.error('Error seeding drugs:', error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
};

seedDrugs();
