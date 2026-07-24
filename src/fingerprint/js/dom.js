import { getDocument, 
        getWindow,
        getLanguages,
        checkCookieEnabled, 
        getTimezone, 
        checkStorage, 
        checkIndexedDb, 
        checkMediaDevices,
        detectFonts,
        checkCanvasSupport,
        checkWebglSupport,
        checkWebgl2Support
        } from "./domUtils.js";

class BrowserFingerprint {
    static async collect() {
        const win = getWindow();
        const doc = getDocument();
        const { screen } = win;

        const user_agent = win.navigator.userAgent;
        const language = win.navigator.language;
        const languages = getLanguages(win.navigator);
        const platform = win.navigator.platform;
        const vendor = win.navigator.vendor;
        const cookie_enabled = checkCookieEnabled(win.navigator);

        const hardware_concurrency = win.navigator.hardwareConcurrency;
        const max_touch_points = win.navigator.maxTouchPoints;

        // Usa a resolução física para reduzir diferenças em telas HiDPI.
        const pixel_ratio = win.devicePixelRatio;
        const screen_width = screen.width;
        const screen_height = screen.height;
        const screen_avail_width = screen.availWidth;
        const screen_avail_height = screen.availHeight;
        const screen_color_depth = screen.colorDepth;
        const screen_pixel_depth = screen.pixelDepth;

        const inner_width = win.innerWidth;
        const inner_height = win.innerHeight;
        const outer_width = win.outerWidth;
        const outer_height = win.outerHeight;

        const timezone = getTimezone();
        const timezone_offset = new Date().getTimezoneOffset();

        const local_storage = checkStorage(win, 'localStorage');
        const session_storage = checkStorage(win, 'sessionStorage');
        const indexed_db = checkIndexedDb(win);

        const media_devices = checkMediaDevices(win.navigator);

        const fonts_available = detectFonts();

        const app_name = win.navigator.appName;
        const app_version = win.navigator.appVersion;
        const app_code_name = win.navigator.appCodeName;
        const online = win.navigator.onLine;
        const webdriver = win.navigator.webdriver;
        const product = win.navigator.product;
        const product_sub = win.navigator.productSub;
        const java_enabled = false;

        const canvas_support = checkCanvasSupport(doc);
        const webgl_support = checkWebglSupport(doc);
        const webgl2_support = checkWebgl2Support(doc);

        return {
            user_agent,
            language,
            languages,
            platform,
            vendor,
            cookie_enabled,
            hardware_concurrency,
            max_touch_points,
            screen_width,
            screen_height,
            screen_avail_width,
            screen_avail_height,
            screen_color_depth,
            screen_pixel_depth,
            screen_resolution: `${screen_width}x${screen_height}`,
            pixel_ratio,
            inner_width,
            inner_height,
            outer_width,
            outer_height,
            timezone,
            timezone_offset,
            local_storage,
            session_storage,
            indexed_db,
            media_devices,
            fonts_available,
            java_enabled,
            webdriver,
            product,
            product_sub,
            app_name,
            app_version,
            app_code_name,
            online,
            canvas_support,
            webgl_support,
            webgl2_support
        };
    }
}

export function getBrowserFingerprint() {
    return BrowserFingerprint.collect();
}
