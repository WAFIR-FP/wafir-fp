import { renderTemplate } from '../views/view.engine.js';
import QRCode from 'qrcode';
import config from '../config/index.js';

const getPublicBaseUrl = (req) => {
    if (config.server.publicBaseUrl) return config.server.publicBaseUrl;
    const host = req.get('host');
    return host ? `${req.protocol}://${host}` : config.api.baseUrl;
};

const sendTemplate = async (res, templateName, errorMessage, data = {}) => {
    try {
        const html = await renderTemplate(templateName, data);
        res.send(html);
    } catch (error) {
        console.error(`Error rendering ${templateName} view:`, error);
        res.status(500).send(errorMessage);
    }
};

const renderHome = async (req, res) => {
    const collectionUrl = new URL('/coleta-fingerprint', getPublicBaseUrl(req)).toString();

    try {
        const qrCodeDataUrl = await QRCode.toDataURL(collectionUrl, {
            width: 420,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: {
                dark: '#0f1e3a',
                light: '#ffffff'
            }
        });

        await sendTemplate(
            res,
            'home',
            'Failed to render home page',
            {
                collectionUrl,
                qrCodeDataUrl
            }
        );
    } catch (error) {
        console.error('Error generating QR code:', error);
        await sendTemplate(
            res,
            'home',
            'Failed to render home page',
            {
                collectionUrl,
                qrCodeDataUrl: ''
            }
        );
    }
};

const renderSobre = async (_req, res) => {
    await sendTemplate(res, 'sobre', 'Failed to render about page');
};

const renderColetaFingerprint = async (req, res) => {
    await sendTemplate(res, 'coleta-fingerprint', 'Failed to render fingerprint collection page');
};

const renderTestStats = async (req, res) => {
    await sendTemplate(res, 'test-stats', 'Failed to render stats test page');
};

const redirectLegacyHome = (req, res) => {
    res.redirect('/');
};

const redirectLegacySobre = (_req, res) => {
    res.redirect('/sobre');
};

const redirectLegacyColetaFingerprint = (req, res) => {
    res.redirect('/coleta-fingerprint');
};

const redirectLegacyTestStats = (req, res) => {
    res.redirect('/test-stats');
};

export {
    renderHome,
    renderSobre,
    renderColetaFingerprint,
    renderTestStats,
    redirectLegacyHome,
    redirectLegacySobre,
    redirectLegacyColetaFingerprint,
    redirectLegacyTestStats
};
