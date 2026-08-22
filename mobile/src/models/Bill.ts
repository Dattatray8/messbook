import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBillItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IBill extends Document {
  messId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  items: IBillItem[];
  totalAmount: number;
  status: "Generated" | "PAID";
  createdAt: Date;
  updatedAt: Date;
}

const billItemSchema = new mongoose.Schema<IBillItem>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
    },

    unitPrice: {
      type: Number,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const billSchema = new mongoose.Schema<IBill>(
  {
    messId: {
      type: Schema.Types.ObjectId,
      ref: "Mess",
      required: true,
      index: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    items: {
      type: [billItemSchema],
      default: [],
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["PAID", "Generated"],
      default: "Generated",
    },
  },
  {
    timestamps: true,
  },
);

const Bill: Model<IBill> =
  mongoose.models.Bill || mongoose.model<IBill>("Bill", billSchema);

export default Bill;
