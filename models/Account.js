import mongoose from "mongoose"

const AccountResourceSchema = new mongoose.Schema(
  {
    resourceName: { type: String, required: true, trim: true },
    fileName: { type: String, default: "", trim: true },
    quantity: { type: Number, required: true, min: 0 },
    claimedQuantity: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
)

const AccountActivityCycleSchema = new mongoose.Schema(
  {
    cycleNumber: { type: Number, required: true, min: 1 },
    totalDrops: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
)

const AccountActivityDropSchema = new mongoose.Schema(
  {
    cycleNumber: { type: Number, required: true, min: 1 },
    tapNumber: { type: Number, required: true, min: 1 },
    resourceName: { type: String, required: true, trim: true },
    fileName: { type: String, default: "", trim: true },
    quantity: { type: Number, default: 1, min: 1 },
    claim: { type: Boolean, default: false },
    claimedAt: { type: Date, default: null },
  },
  { _id: false }
)

const AccountActivityProgressSchema = new mongoose.Schema(
  {
    currentCycle: { type: Number, default: 1, min: 1 },
    currentTapInCycle: { type: Number, default: 0, min: 0 },
    claimedDrops: { type: Number, default: 0, min: 0 },
    coolDownUntil: { type: Date, default: null },
    coolDownMinutes: { type: Number, default: 30, min: 1 },
  },
  { _id: false }
)

const AccountActivitySchema = new mongoose.Schema(
  {
    tapsPerCycle: { type: Number, default: 1, min: 1 },
    coolDownMinutes: { type: Number, default: 30, min: 1 },
    validityHours: { type: Number, default: 24, min: 1 },
    totalCycles: { type: Number, default: 1, min: 1 },
    totalTapSlots: { type: Number, default: 1, min: 1 },
    totalDrops: { type: Number, default: 0, min: 0 },
    cycles: {
      type: [AccountActivityCycleSchema],
      default: [],
    },
    timeline: {
      type: [AccountActivityDropSchema],
      default: [],
    },
    progress: {
      type: AccountActivityProgressSchema,
      default: () => ({
        currentCycle: 1,
        currentTapInCycle: 0,
        claimedDrops: 0,
        coolDownUntil: null,
        coolDownMinutes: 30,
      }),
    },
  },
  { _id: false }
)

const AccountSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PriceList",
      required: true,
      index: true,
    },
    packageName: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    validityHours: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: Boolean,
      default: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    clickCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    resources: {
      type: [AccountResourceSchema],
      default: [],
    },
    activity: {
      type: AccountActivitySchema,
      default: () => ({
        tapsPerCycle: 1,
        coolDownMinutes: 30,
        validityHours: 24,
        totalCycles: 1,
        totalTapSlots: 1,
        totalDrops: 0,
        cycles: [],
        timeline: [],
        progress: {
          currentCycle: 1,
          currentTapInCycle: 0,
          claimedDrops: 0,
          coolDownUntil: null,
          coolDownMinutes: 30,
        },
      }),
    },
    expireAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
)

export default mongoose.models.Account || mongoose.model("Account", AccountSchema)