const jwt = require('jsonwebtoken');
const { User } = require('../models/projectModels');

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const getTokenFromRequest = req => {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
        return '';
    }
    return header.slice(7).trim();
};

const getUserIdFromToken = req => {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    try {
        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET || 'your_super_secret_key_for_development'
        );
        return payload.userId || null;
    } catch (_error) {
        return null;
    }
};

const verifyRoleUser = async (req, allowedRoles, errorMessage) => {
    const token = getTokenFromRequest(req);

    if (!token) {
        return { ok: false, status: 401, error: 'Authorization token missing.' };
    }

    try {
        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET || 'your_super_secret_key_for_development'
        );
        const user = await User.findById(payload.userId).lean();

        if (!user) {
            return { ok: false, status: 401, error: 'User not found.' };
        }

        if (!allowedRoles.includes(user.role)) {
            return { ok: false, status: 403, error: errorMessage };
        }

        return { ok: true, user };
    } catch (_error) {
        return { ok: false, status: 401, error: 'Invalid or expired token.' };
    }
};

const verifyAdminUser = req =>
    verifyRoleUser(req, ['admin'], 'Admin access required.');

const verifyStaffUser = req =>
    verifyRoleUser(req, ['admin', 'instructor'], 'Staff (Instructor or Admin) access required.');

const requireAdmin = async (req, res, next) => {
    const authCheck = await verifyAdminUser(req);
    if (!authCheck.ok) {
        return res.status(authCheck.status).json({ error: authCheck.error });
    }
    req.adminUser = authCheck.user;
    return next();
};

const requireStaff = async (req, res, next) => {
    const authCheck = await verifyStaffUser(req);
    if (!authCheck.ok) {
        return res.status(authCheck.status).json({ error: authCheck.error });
    }
    req.staffUser = authCheck.user;
    return next();
};

const requireOwnAccount = (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (!token) {
        return res.status(401).json({ error: 'Authorization token missing.' });
    }

    try {
        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET || 'your_super_secret_key_for_development'
        );
        if (String(payload.userId) !== String(req.params.userId) && payload.role !== 'admin') {
            return res.status(403).json({ error: 'You can only access your own account.' });
        }
        return next();
    } catch (_error) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

module.exports = {
    asyncHandler,
    getTokenFromRequest,
    getUserIdFromToken,
    verifyRoleUser,
    verifyAdminUser,
    verifyStaffUser,
    requireAdmin,
    requireStaff,
    requireOwnAccount,
};
