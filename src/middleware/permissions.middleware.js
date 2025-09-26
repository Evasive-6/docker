const permissions = (requiredPermissions = []) => {
    return (req, res, next) => {
        try {
            const admin = req.admin;
            if (!admin) {
                return res.status(401).json({ message: "Admin not authenticated" });
            }

            const hasPermission = requiredPermissions.every(p => admin.permissions.includes(p));
            if (!hasPermission) {
                return res.status(403).json({ message: "Insufficient permissions" });
            }

            next();
        } catch (err) {
            console.error("Permissions Middleware Error:", err);
            res.status(500).json({ message: "Server error" });
        }
    };
};

module.exports = permissions;
