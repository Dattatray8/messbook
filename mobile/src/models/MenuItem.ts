import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMenuItem extends Document {
  messId: mongoose.Types.ObjectId;
  name: string;
  category: "BREAKFAST" | "LUNCH" | "DINNER" | "EXTRA";
  price: number;
  unit?: string;
  createdAt: Date;
  updatedAt: Date;
}

const menuItemSchema = new mongoose.Schema<IMenuItem>(
  {
    messId: {
      type: Schema.Types.ObjectId,
      ref: "Mess",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: ["BREAKFAST", "LUNCH", "DINNER", "EXTRA"],
      required: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      trim: true,
      default: "plate",
    },
  },
  {
    timestamps: true,
  },
);

const MenuItem: Model<IMenuItem> =
  mongoose.models.MenuItem ||
  mongoose.model<IMenuItem>("MenuItem", menuItemSchema);

export default MenuItem;
