import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICustomer extends Document {
  messId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  billingType: "PAY_PER_MEAL" | "WEEKLY" | "MONTHLY";
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new mongoose.Schema<ICustomer>(
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

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    billingType: {
      type: String,
      enum: ["PAY_PER_MEAL", "WEEKLY", "MONTHLY"],
      required: true,
      default: "PAY_PER_MEAL",
    },
  },
  {
    timestamps: true,
  },
);

const Customer: Model<ICustomer> =
  mongoose.models.Customer ||
  mongoose.model<ICustomer>("Customer", customerSchema);

export default Customer;
