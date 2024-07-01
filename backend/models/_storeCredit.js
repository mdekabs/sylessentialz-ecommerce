import mongoose from "mongoose";

const storeCreditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, default: 0 },
  expiryDate: { type: Date, default: null }
});

const StoreCredit = mongoose.model('StoreCredit', storeCreditSchema);

export default StoreCredit;
