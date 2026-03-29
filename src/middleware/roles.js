const { env } = require("../config/env");
const { fail } = require("../utils/response");

function attachActor(req, _res, next) {
  const roleHeader = String(req.headers["x-user-role"] || "").trim().toLowerCase();
  const phoneHeader = String(req.headers["x-user-phone"] || "").trim();

  req.actor = {
    role: roleHeader || null,
    phone: phoneHeader || null,
  };

  next();
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const role = req.actor?.role;

    if (!env.requireRoleEnforcement && !role) {
      return next();
    }

    if (!role || !allowedRoles.includes(role)) {
      return fail(res, `Role not allowed. Expected one of: ${allowedRoles.join(", ")}`, 403);
    }

    return next();
  };
}

module.exports = {
  attachActor,
  requireRole,
};
