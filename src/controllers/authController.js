const { z } = require("zod");
const { randomUUID } = require("crypto");
const { db, nowIso, createPhoneUser } = require("../data/store");
const { ok, fail } = require("../utils/response");

// Validation schemas with security in mind
const signupSchema = z.object({
  phone: z
    .string()
    .regex(/^254[1-9]\d{8}$/, "Phone must be valid Kenya format: 254XXXXXXXXX")
    .describe("Phone number in E.164 format"),

  name: z
    .string()
    .min(2, "Name too short")
    .max(100, "Name too long")
    .regex(/^[a-zA-Z\s'-]+$/, "Name contains invalid characters")
    .describe("Full name of the user"),

  email: z
    .string()
    .email("Invalid email format")
    .max(255, "Email too long")
    .optional()
    .nullable()
    .describe("Email address (optional)"),

  role: z
    .enum(["buyer", "seller"])
    .describe("User role in marketplace"),

  idNumber: z
    .string()
    .regex(/^\d{5,8}$/, "ID number must be 5-8 digits")
    .optional()
    .nullable()
    .describe("National ID (seller verification)"),

  termsAccepted: z
    .boolean()
    .refine((val) => val === true, {
      message: "Must accept terms and conditions",
    })
    .describe("Accept marketplace terms & conditions"),
});

const loginSchema = z.object({
  phone: z
    .string()
    .regex(/^254[1-9]\d{8}$/, "Invalid phone format"),
});

/**
 * User Signup Handler
 * Creates a new user account with role-based initialization
 * Implements safety checks:
 * - Phone format validation (Kenya number)
 * - Duplicate account prevention
 * - Role-based defaults (seller = verified later, buyer = instant)
 */
async function signupHandler(req, res) {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, "Validation failed", 422, parsed.error.flatten());
    }

    const { phone, name, email, role, idNumber, termsAccepted } = parsed.data;

    // Check if user already exists
    if (db.users.has(phone)) {
      return fail(res, "Phone number already registered", 409);
    }

    // Create new user with role-specific fields
    const user = {
      id: randomUUID(),
      phone,
      name,
      email: email || null,
      role,
      termsAccepted,
      createdAt: nowIso(),
      updatedAt: nowIso(),

      // Role-specific tracking
      ...(role === "seller" && {
        verified: false, // Seller verification pending
        verificationCode: generateVerificationCode(),
        verificationAttempts: 0,
        verificationExpiry: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
        idNumber: idNumber || null,
        bankName: null,
        bankAccount: null,
        booksSoldCount: 0,
        averageRating: 0,
        totalEarnings: 0,
      }),
      ...(role === "buyer" && {
        defaultPhone: phone,
        savedAddresses: [],
        purchaseCount: 0,
        totalSpent: 0,
        averageRating: 0,
      }),
    };

    // Store user
    db.users.set(phone, user);

    // Log signup event for audit
    logAuditEvent("USER_SIGNUP", {
      phone,
      role,
      timestamp: nowIso(),
    });

    return ok(
      res,
      {
        id: user.id,
        phone,
        name,
        role,
        message: role === "seller" ? "Seller verification required" : "Welcome to BookMarket",
      },
      201
    );
  } catch (error) {
    console.error("[Auth] Signup error:", error);
    return fail(res, "Signup failed", 500);
  }
}

/**
 * Login Handler (Phone-based)
 * In production, this would generate OTP or email link
 * For MVP, we assume phone verification happens client-side
 */
async function loginHandler(req, res) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, "Validation failed", 422, parsed.error.flatten());
    }

    const { phone } = parsed.data;
    const user = db.users.get(phone);

    if (!user) {
      // Don't reveal if account exists (security best practice)
      return ok(res, {
        success: true,
        message: "If account exists, check your phone for next steps",
      });
    }

    // In production: send OTP via SMS
    // For MVP: log and return success
    logAuditEvent("USER_LOGIN", {
      phone,
      timestamp: nowIso(),
    });

    return ok(res, {
      id: user.id,
      phone,
      name: user.name,
      role: user.role,
      verified: user.verified || true, // Buyers always verified
      message: user.role === "seller" && !user.verified ? "Seller still pending verification" : "Login successful",
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    return fail(res, "Login failed", 500);
  }
}

/**
 * Get Current User Handler
 * Returns user profile and role-specific data
 */
function getUserHandler(req, res) {
  try {
    const phone = req.actor?.phone;
    if (!phone) {
      return fail(res, "No authenticated user", 401);
    }

    const user = db.users.get(phone);
    if (!user) {
      return fail(res, "User not found", 404);
    }

    // Return safe user data
    const safeUser = {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      verified: user.verified !== undefined ? user.verified : true,
      createdAt: user.createdAt,
      ...(user.role === "seller" && {
        booksSoldCount: user.booksSoldCount || 0,
        averageRating: user.averageRating || 0,
        totalEarnings: user.totalEarnings || 0,
      }),
      ...(user.role === "buyer" && {
        purchaseCount: user.purchaseCount || 0,
        totalSpent: user.totalSpent || 0,
      }),
    };

    return ok(res, safeUser);
  } catch (error) {
    console.error("[Auth] Get user error:", error);
    return fail(res, "Failed to fetch user", 500);
  }
}

/**
 * Seller Verification Handler
 * Verifies seller with OTP/code (admin can also verify)
 */
function verifySellerHandler(req, res) {
  try {
    const { phone, verificationCode } = req.body;

    const user = db.users.get(phone);
    if (!user || user.role !== "seller") {
      return fail(res, "Seller not found", 404);
    }

    if (user.verified) {
      return fail(res, "Seller already verified", 400);
    }

    if (!verificationCode || verificationCode !== user.verificationCode) {
      user.verificationAttempts = (user.verificationAttempts || 0) + 1;
      if (user.verificationAttempts >= 3) {
        user.verificationExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        return fail(res, "Too many failed attempts. Please try again later.", 429);
      }
      return fail(res, "Invalid verification code", 400);
    }

    // Check if code expired
    if (new Date() > new Date(user.verificationExpiry)) {
      user.verificationCode = generateVerificationCode();
      user.verificationExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      return fail(res, "Verification code expired", 400);
    }

    // Mark as verified
    user.verified = true;
    user.verificationCode = null;
    user.verificationAttempts = 0;
    user.verificationExpiry = null;

    logAuditEvent("SELLER_VERIFIED", {
      phone,
      timestamp: nowIso(),
    });

    return ok(res, {
      message: "Seller account verified successfully",
      verified: true,
    });
  } catch (error) {
    console.error("[Auth] Verification error:", error);
    return fail(res, "Verification failed", 500);
  }
}

/**
 * Update User Profile Handler
 */
function updateProfileHandler(req, res) {
  try {
    const phone = req.actor?.phone;
    if (!phone) {
      return fail(res, "No authenticated user", 401);
    }

    const user = db.users.get(phone);
    if (!user) {
      return fail(res, "User not found", 404);
    }

    // Allow updating certain fields
    const allowedFields = ["email", "name"];
    if (user.role === "seller") {
      allowedFields.push("bankName", "bankAccount");
    }

    allowedFields.forEach((field) => {
      if (field in req.body) {
        user[field] = req.body[field];
      }
    });

    user.updatedAt = nowIso();

    return ok(res, {
      message: "Profile updated successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("[Auth] Update profile error:", error);
    return fail(res, "Failed to update profile", 500);
  }
}

/**
 * Utility: Generate verification code
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Utility: Log audit events for security tracking
 */
function logAuditEvent(eventType, data) {
  db.auditLog = db.auditLog || [];
  db.auditLog.push({
    id: randomUUID(),
    eventType,
    data,
    timestamp: nowIso(),
  });

  // Keep only last 10,000 events in memory
  if (db.auditLog.length > 10000) {
    db.auditLog = db.auditLog.slice(-10000);
  }
}

module.exports = {
  signupHandler,
  loginHandler,
  getUserHandler,
  verifySellerHandler,
  updateProfileHandler,
};
