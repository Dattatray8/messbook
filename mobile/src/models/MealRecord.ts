import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMealRecord extends Document {
  messId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER";
  mealName: string;
  mealQuantity: number;
  mealUnitPrice: number;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

const mealRecordSchema = new mongoose.Schema<IMealRecord>(
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

    mealType: {
      type: String,
      enum: ["BREAKFAST", "LUNCH", "DINNER"],
      required: true,
    },

    mealName: {
      type: String,
      required: true,
      trim: true,
    },

    mealQuantity: {
      type: Number,
      required: true,
    },

    mealUnitPrice: {
      type: Number,
      required: true,
    },

    totalAmount: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const MealRecord: Model<IMealRecord> =
  mongoose.models.MealRecord ||
  mongoose.model<IMealRecord>("MealRecord", mealRecordSchema);

export default MealRecord;
