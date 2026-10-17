const mongoose = require("mongoose");

const gallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Activity title is required"],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    description: {
      type: String,
      required: [true, "Activity description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    imageUrl: {
      type: String,
      required: [true, "Activity image is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "Reunion",
        "Campus & Nostalgia",
        "Welfare & Charity",
        "Sports & Tournaments",
        "Cultural & Events",
        "Academic & Career",
        "General",
      ],
      default: "General",
    },
    activityDate: {
      type: Date,
      default: Date.now,
    },
    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    uploaderName: {
      type: String,
      default: "Alumni Member",
    },
    uploaderBatch: {
      type: String,
      default: "",
    },
    uploaderImage: {
      type: String,
      default: "",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likeCount: {
      type: Number,
      default: 0,
      index: true,
    },
    status: {
      type: String,
      enum: ["approved", "pending"],
      default: "approved",
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient sorting and search
gallerySchema.index({ createdAt: -1 });
gallerySchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model("Gallery", gallerySchema);
