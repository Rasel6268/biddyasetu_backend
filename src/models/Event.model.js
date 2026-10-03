const mongoose = require("mongoose");

const AttendeeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
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
  email: {
    type: String,
    trim: true,
    default: "",
  },
  batch: {
    type: String,
    trim: true,
    default: "",
  },
  guestCount: {
    type: Number,
    default: 1,
    min: 1,
    max: 10,
  },
  status: {
    type: String,
    enum: ["confirmed", "waitlist", "cancelled"],
    default: "confirmed",
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
});

const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, "Event description is required"],
      trim: true,
    },
    eventType: {
      type: String,
      enum: ["Reunion", "Ceremony", "Workshop", "Fundraiser", "Sports", "General"],
      default: "Reunion",
    },
    date: {
      type: String,
      required: [true, "Event date is required (e.g. 2026-12-20)"],
    },
    time: {
      type: String,
      default: "09:00 AM - 05:00 PM",
    },
    venue: {
      type: String,
      required: [true, "Event venue is required"],
      trim: true,
    },
    locationMapUrl: {
      type: String,
      default: "",
    },
    bannerImage: {
      type: String,
      default: "",
    },
    fee: {
      type: String,
      default: "Free",
    },
    feeAmount: {
      type: Number,
      default: 0,
    },
    capacity: {
      type: Number,
      default: 500,
    },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed", "cancelled"],
      default: "upcoming",
    },
    featured: {
      type: Boolean,
      default: false,
    },
    organizer: {
      type: String,
      default: "Biddyasetu Executive Committee",
    },
    attendees: [AttendeeSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for attendee count
EventSchema.virtual("attendeeCount").get(function () {
  if (!this.attendees) return 0;
  return this.attendees.filter((a) => a.status === "confirmed").length;
});

// Auto-generate slug before save
EventSchema.pre("save", function () {
  if (this.isModified("title") && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
});

module.exports = mongoose.model("Event", EventSchema);
