import { Schema, model, Document, Types } from 'mongoose';

export interface IUserDevice extends Document {
  user_id: Types.ObjectId;
  device_token: string;
  platform: 'ios' | 'android';
  created_at: Date;
  updated_at: Date;
}

const UserDeviceSchema = new Schema<IUserDevice>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    device_token: { type: String, required: true, unique: true, index: true },
    platform: { type: String, enum: ['ios', 'android'], required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Compound index to speed up cleanup/queries by user and token
UserDeviceSchema.index({ user_id: 1, device_token: 1 });

export const UserDevice = model<IUserDevice>('UserDevice', UserDeviceSchema);
export default UserDevice;
