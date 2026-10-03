const mongoose = require("mongoose");

const AnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Announcement title is required"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Announcement content is required"],
      trim: true,
    },
    priority: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
    },
    category: {
      type: String,
      enum: ["General", "Urgent", "Reunion", "Scholarship", "Election", "Welfare"],
      default: "General",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["published", "draft", "archived"],
      default: "published",
    },
    link: {
      type: String,
      default: "",
    },
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

// Indexes for fast querying
AnnouncementSchema.index({ status: 1, date: -1 });
AnnouncementSchema.index({ isPinned: -1, date: -1 });

module.exports = mongoose.model("Announcement", AnnouncementSchema);
