import { Schema, model } from 'mongoose';

const hospitalSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameShort: { type: String, trim: true, default: '' },
    code: { type: String, required: true, unique: true, trim: true, index: true },
    taxCode: { type: String, trim: true, default: '' },
    licenseFile: { type: String, default: '' },

    loginEmail: { type: String, trim: true, lowercase: true, default: '' },
    tempUsername: { type: String, default: '' },

    address: {
      street: { type: String, default: '' },
      ward: { type: String, default: '' },
      district: { type: String, default: '' },
      province: { type: String, default: '' },
    },
    phone: { type: String, default: '' },
    contactEmail: { type: String, trim: true, lowercase: true, default: '' },
    website: { type: String, default: '' },
    fax: { type: String, default: '' },

    legalRep: {
      name: { type: String, default: '' },
      position: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
    },

    itContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
    },

    status: {
      type: String,
      enum: ['provisioned', 'submitted', 'active', 'rejected'],
      default: 'provisioned',
    },

    pricing: {
      examFee: { type: Number, default: 150000 },
      mriFee: { type: Number, default: 1500000 },
      aiFee: { type: Number, default: 200000 },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Hospital = model('Hospital', hospitalSchema);
export default Hospital;
