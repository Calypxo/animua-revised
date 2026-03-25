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