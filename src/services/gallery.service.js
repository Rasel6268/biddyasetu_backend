const Gallery = require("../models/Gallery.model");
const User = require("../models/Users.model");
const AppError = require("../utility/appError");

// High quality initial seed activities so the gallery looks vibrant from day one
const defaultGallerySeed = [
  {
    title: "Grand Alumni Reunion & Cultural Night 2025",
    description: "Memorable moments from the 2025 Grand Reunion held on the school campus grounds. Alumni from batches 1980 to 2024 reunited with beloved teachers and reminisced about school days.",
    imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
    category: "Reunion",
    activityDate: new Date("2025-01-15"),
    uploaderName: "Md Emdadul Haque",
    uploaderBatch: "SSC 1996",
    uploaderImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    likeCount: 42,
  },
  {
    title: "Annual Merit Scholarship Award Ceremony 2025",
    description: "Biddyasetu Welfare Trust distributed full scholarships and STEM learning kits to 35 underprivileged students of Adarsha High School, Kaitola.",
    imageUrl: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80",
    category: "Welfare & Charity",
    activityDate: new Date("2025-03-10"),
    uploaderName: "Dr. Kazi Mahfuzur Rahman",
    uploaderBatch: "SSC 1992",
    uploaderImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    likeCount: 38,
  },
  {
    title: "Inter-Batch Friendly Cricket Championship",
    description: "Exciting weekend cricket tournament on the school playground between Batch '96, '02, '08, and '14. Batch 2008 lifted the trophy after a thrilling super-over finish!",
    imageUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=1200&q=80",
    category: "Sports & Tournaments",
    activityDate: new Date("2025-02-22"),
    uploaderName: "Tariqul Islam",
    uploaderBatch: "SSC 2008",
    uploaderImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    likeCount: 29,
  },
  {
    title: "Campus Tree Plantation & Green School Initiative",
    description: "Alumni volunteers planted 150 mahogany, neem, and fruit-bearing trees along the boundary wall and school pond to ensure a greener environment for our next generation.",
    imageUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
    category: "Campus & Nostalgia",
    activityDate: new Date("2025-04-05"),
    uploaderName: "Nasreen Akter",
    uploaderBatch: "SSC 2004",
    uploaderImage: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    likeCount: 31,
  },
  {
    title: "Modern Computer Lab & Science Facility Inauguration",
    description: "Honoring our patron and lifetime members whose generous donations built the school's new 30-workstation ICT and Science Innovation Lab.",
    imageUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80",
    category: "Academic & Career",
    activityDate: new Date("2025-05-18"),
    uploaderName: "Md Emdadul Haque",
    uploaderBatch: "SSC 1996",
    uploaderImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    likeCount: 54,
  },
  {
    title: "Pohela Boishakh 1432 Cultural Celebration",
    description: "Bangla New Year celebrated with traditional folk songs, pitha festival, and art competitions organized jointly by students and alumni council.",
    imageUrl: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1200&q=80",
    category: "Cultural & Events",
    activityDate: new Date("2025-04-14"),
    uploaderName: "Sumon Debnath",
    uploaderBatch: "SSC 2012",
    uploaderImage: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80",
    likeCount: 26,
  },
];

class GalleryService {
  /**
   * Seed default activities if collection is empty
   */
  async ensureSeedDefaults() {
    const count = await Gallery.countDocuments();
    if (count === 0) {
      // Find an admin or any member to assign as default uploader
      const anyUser = await User.findOne();
      const uploaderId = anyUser ? anyUser._id : new User()._id;

      const seedsWithUser = defaultGallerySeed.map((s) => ({
        ...s,
        uploader: uploaderId,
      }));

      await Gallery.insertMany(seedsWithUser);
    }
  }

  /**
   * Get all gallery activities with optional filtering and like status
   */
  async getGalleryItems({ category, search, sortBy = "newest", page = 1, limit = 50 }, currentUserId = null) {
    await this.ensureSeedDefaults();

    const query = { status: "approved" };

    if (category && category !== "All" && category !== "all") {
      query.category = category;
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { title: { $regex: s, $options: "i" } },
        { description: { $regex: s, $options: "i" } },
        { uploaderName: { $regex: s, $options: "i" } },
        { uploaderBatch: { $regex: s, $options: "i" } },
      ];
    }

    const sortOptions = {};
    if (sortBy === "popular") {
      sortOptions.likeCount = -1;
      sortOptions.createdAt = -1;
    } else {
      sortOptions.createdAt = -1;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Gallery.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate("uploader", "name batch profileImage membership"),
      Gallery.countDocuments(query),
    ]);

    // Format with isLiked flag for current user
    const formattedItems = items.map((item) => {
      const obj = item.toObject();
      const userIdStr = currentUserId ? String(currentUserId) : null;
      obj.isLiked = userIdStr
        ? Array.isArray(obj.likes) && obj.likes.some((id) => String(id) === userIdStr)
        : false;
      return obj;
    });

    return {
      items: formattedItems,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  /**
   * Upload / create a new gallery activity
   */
  async createGalleryItem(data, user) {
    if (user.role !== "admin" && user.role !== "superadmin") {
      throw new AppError("Only administrators are authorized to upload gallery activities.", 403);
    }

    const { title, description, imageUrl, category, activityDate } = data;

    if (!title || !title.trim()) {
      throw new AppError("Activity title is required.", 400);
    }

    if (!description || !description.trim()) {
      throw new AppError("Activity description is required.", 400);
    }

    if (!imageUrl || !imageUrl.trim()) {
      throw new AppError("Please provide an image for the activity.", 400);
    }

    const newActivity = new Gallery({
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      category: category || "General",
      activityDate: activityDate ? new Date(activityDate) : new Date(),
      uploader: user._id,
      uploaderName: user.name || "Alumni Member",
      uploaderBatch: user.batch ? `SSC ${user.batch}` : "",
      uploaderImage: user.profileImage || "",
      likes: [],
      likeCount: 0,
      status: "approved",
    });

    await newActivity.save();
    return newActivity;
  }

  /**
   * Toggle Like on an activity
   */
  async toggleLike(galleryId, userId) {
    const item = await Gallery.findById(galleryId);
    if (!item) {
      throw new AppError("Gallery activity not found.", 404);
    }

    const userIdStr = String(userId);
    const existingIndex = item.likes.findIndex((id) => String(id) === userIdStr);

    let isLiked = false;

    if (existingIndex > -1) {
      // Unlike
      item.likes.splice(existingIndex, 1);
      item.likeCount = Math.max(0, item.likes.length);
      isLiked = false;
    } else {
      // Like
      item.likes.push(userId);
      item.likeCount = item.likes.length;
      isLiked = true;
    }

    await item.save();

    return {
      galleryId: item._id,
      isLiked,
      likeCount: item.likeCount,
    };
  }

  /**
   * Delete an activity (by author or admin)
   */
  async deleteGalleryItem(galleryId, userId, userRole) {
    const item = await Gallery.findById(galleryId);
    if (!item) {
      throw new AppError("Gallery activity not found.", 404);
    }

    const isAdmin = userRole === "admin" || userRole === "superadmin";

    if (!isAdmin) {
      throw new AppError("Only administrators have permission to delete gallery activities.", 403);
    }

    await Gallery.findByIdAndDelete(galleryId);
    return { success: true, message: "Activity deleted successfully." };
  }
}

module.exports = new GalleryService();
