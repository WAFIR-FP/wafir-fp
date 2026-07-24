import fsSync from 'fs';
import crypto from 'crypto';
import * as logService from '../services/log.service.js';
import * as sessionService from '../services/session.service.js';
import { renderTemplate } from '../views/view.engine.js';
import config from '../config/index.js';

const ADMIN_USERNAME = config.security.admin.username;
const ADMIN_PASSWORD = config.security.admin.password;

const safeEqual = (left, right) => {
    const leftDigest = crypto.createHash('sha256').update(String(left ?? '')).digest();
    const rightDigest = crypto.createHash('sha256').update(String(right ?? '')).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
};

const adminCookieOptions = {
    httpOnly: true,
    secure: config.server.isProduction,
    sameSite: 'strict',
    path: '/admin',
    maxAge: 24 * 60 * 60 * 1000
};

const renderLogin = async (req, res) => {
    try {
        const html = await renderTemplate('login');
        res.send(html);
    } catch (error) {
        console.error('Error rendering login view:', error);
        res.status(500).send('Failed to render login page');
    }
};

const verifyLogin = (req, res) => {
    const { username, password } = req.body || {};
    const usernameMatches = safeEqual(username, ADMIN_USERNAME);
    const passwordMatches = safeEqual(password, ADMIN_PASSWORD);

    if (usernameMatches && passwordMatches) {
        const sessionToken = crypto.randomBytes(32).toString('hex');

        sessionService.createSession(sessionToken, {
            username,
            isAdmin: true
        });

        res.cookie('adminSession', sessionToken, adminCookieOptions);

        return res.json({
            success: true,
            message: 'Login successful'
        });
    }

    res.status(401).json({
        success: false,
        error: 'Invalid credentials'
    });
};

const redirectToLogin = (req, res) => {
    res.redirect('/admin/login');
};

const logout = (req, res) => {
    const sessionToken = req.cookies?.adminSession;

    if (sessionToken) {
        sessionService.deleteSession(sessionToken);
    }

    res.clearCookie('adminSession', {
        secure: adminCookieOptions.secure,
        sameSite: adminCookieOptions.sameSite,
        path: adminCookieOptions.path
    });

    res.json({
        success: true,
        message: 'Logout successful'
    });
};

const renderDashboard = async (req, res) => {
    try {
        const html = await renderTemplate('admin');
        res.send(html);
    } catch (error) {
        console.error('Error rendering admin dashboard:', error);
        res.status(500).send('Failed to render admin dashboard');
    }
};

const resetLogs = async (req, res) => {
    try {
        console.log('Admin requested reset');
        await logService.resetLogs();

        res.json({
            success: true,
            message: 'Logs have been reset successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error resetting logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset logs'
        });
    }
};

const downloadLogs = async (req, res) => {
    try {
        const logFile = logService.getLogFilePath();

        // Bancos não possuem um arquivo físico para download.
        if (logService.isDatabaseStorage && logService.isDatabaseStorage()) {
            const jsonContent = await logService.getLogsAsJson();
            if (!jsonContent || jsonContent === '[]') {
                return res.status(404).json({
                    success: false,
                    error: 'No logs available'
                });
            }
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="fingerprints.json"');
            return res.send(jsonContent);
        }

        if (!fsSync.existsSync(logFile)) {
            return res.status(404).json({
                success: false,
                error: 'Log file not found'
            });
        }

        res.download(logFile, 'fingerprints.json', (err) => {
            if (err) {
                console.error('Error downloading log file:', err);
                res.status(500).json({
                    success: false,
                    error: 'Failed to download log file'
                });
            }
        });
    } catch (error) {
        console.error('Error accessing log file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to access log file'
        });
    }
};

const viewLogs = async (req, res) => {
    try {
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(500, Math.max(1, requestedLimit))
            : 100;
        const logs = await logService.readLogs();

        res.json({
            success: true,
            total: logs.length,
            logs: logs.slice(-limit).reverse()
        });
    } catch (error) {
        console.error('Error viewing logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to view logs'
        });
    }
};

export {
    renderLogin,
    verifyLogin,
    redirectToLogin,
    logout,
    renderDashboard,
    resetLogs,
    downloadLogs,
    viewLogs
};
