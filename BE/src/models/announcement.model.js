import { Schema, model } from 'mongoose';

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    type: { type: String, enum: ['info', 'warning', 'maintenance'], default: 'info' },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Announcement = model('Announcement', announcementSchema);
export default Announcement;
