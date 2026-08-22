import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMess extends Document {
  name: string;
  ownerId: mongoose.Types.ObjectId;
  phone?: string;
  logo?: string;
  mealTypes: ("BREAKFAST" | "LUNCH" | "DINNER")[];
  createdAt: Date;
  updatedAt: Date;
}

const messSchema = new mongoose.Schema<IMess>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    logo: {
      type: String,
    },

    mealTypes: {
      type: [String],
      enum: ["BREAKFAST", "LUNCH", "DINNER"],
      default: ["BREAKFAST", "LUNCH", "DINNER"],
    },
  },
  {
    timestamps: true,
  },
);

const Mess: Model<IMess> =
  mongoose.models.Mess || mongoose.model<IMess>("Mess", messSchema);

export default Mess;
