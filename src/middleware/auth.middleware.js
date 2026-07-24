import * as sessionService from '../services/session.service.js';

// O painel usa exclusivamente a sessão HttpOnly criada no login.
const authenticateAdmin = (req, res, next) => {
    const sessionToken = req.cookies?.adminSession;
    if (sessionToken) {
        const session = sessionService.getSession(sessionToken);
        if (session && session.isAdmin) {
            req.adminSession = session;
            return next();
        }
    }

    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized. Please provide valid admin credentials.'
        });
    }

    res.redirect('/admin/login');
};

export { authenticateAdmin };
