const {
  registerService,
  loginService,
  authMeService,
  payMembershipService,
  updateProfileService,
  changePasswordService,
} = require("../services/auth.service");
const { setAuthCookie, clearAuthCookie } = require("../utility/jwt.util");

/**
 * Register Controller
 */
const registerController = async (req, res, next) => {
  try {
    const result = await registerService(req.body);

    // Set HTTP-Only Cookie
    setAuthCookie(res, result.token);

    return res.status(201).json({
      success: true,
      message: "Registration completed successfully! Welcome to Biddyasetu.",
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login Controller
 */
const loginController = async (req, res, next) => {
  try {
    const { identifier, phone, email, password } = req.body;
    
    const result = await loginService({ identifier, phone, email, password });

    // Set HTTP-Only Cookie
    setAuthCookie(res, result.token);

    return res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Current Authenticated User (Auth Me)
 */
const authMe = async (req, res, next) => {
  try {
    const user = await authMeService(req.user._id);

    return res.status(200).json({
      success: true,
      message: "Authenticated user profile loaded.",
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pay Membership / Subscription Controller
 */
const payMembershipController = async (req, res, next) => {
  try {
    const updatedUser = await payMembershipService(req.user._id, req.body);

    return res.status(200).json({
      success: true,
      message: "Membership subscription activated successfully!",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout Controller
 */
const logoutController = async (req, res, next) => {
  try {
    clearAuthCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Profile Controller
 */
const updateProfileController = async (req, res, next) => {
  try {
    const updatedUser = await updateProfileService(req.user._id, req.body);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change Password Controller
 */
const changePasswordController = async (req, res, next) => {
  try {
    const result = await changePasswordService(req.user._id, req.body);

    return res.status(200).json({
      success: true,
      message: result.message || "Password updated successfully.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerController,
  loginController,
  authMe,
  payMembershipController,
  logoutController,
  updateProfileController,
  changePasswordController,
};
