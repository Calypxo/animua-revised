/**
 * authorizeRole
 *
 * Called AFTER authenticateToken. Checks the verified role from the JWT payload
 * against the list of roles permitted for the route.
 *
 * Usage in server.js:
 *   app.get("/api/admin-only", authenticateToken, authorizeRole("Admin"), handler)
 */
const authorizeRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Access denied. Required role: ${allowedRoles.join(" or ")}.`
            });
        }
        next();
    };
};

module.exports = authorizeRole;