function getWindow() {
    if (typeof window !== 'undefined') {
        return window;
    }
    throw new Error("Objeto 'window' global não encontrado");
}

function getDocument() {
    const win = getWindow();
    const { document } = win;
    if (!document) {
        throw new Error("Window não contém um 'document'");
    }
    return document;
}

function getLanguages(navigator) {
    const result = [];
    const langs = navigator.languages || [];
    for (let i = 0; i < langs.length; i += 1) {
        const value = langs[i];
        if (typeof value === 'string') {
            result.push(value);
        }
    }
    return result;
}

function checkCookieEnabled(navigator) {
    if (typeof navigator.cookieEnabled === 'boolean') {
        return navigator.cookieEnabled;
    }

    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc) {
        return undefined;
    }

    try {
        doc.cookie = 'cookietest=1';
        const ret = doc.cookie.indexOf('cookietest=') !== -1;
        doc.cookie = 'cookietest=1; expires=Thu, 01-Jan-1970 00:00:01 GMT';
        return ret;
    } catch (err) {
        return undefined;
    }
}

function getTimezone() {
    try {
        const options = Intl.DateTimeFormat().resolvedOptions();
        return options.timeZone || 'Unknown';
    } catch (err) {
        return 'Unknown';
    }
}

function checkStorage(window, type) {
    try {
        return type in window && window[type] !== null;
    } catch (err) {
        return undefined;
    }
}

function checkIndexedDb(window) {
    try {
        return 'indexedDB' in window;
    } catch (err) {
        return undefined;
    }
}

function checkMediaDevices(navigator) {
    return !!(navigator.mediaDevices && typeof navigator.mediaDevices === 'object');
}

function detectFonts() {
    return [
        'Arial', 'Verdana', 'Courier New', 'Georgia', 'Palatino',
        'Times New Roman', 'Trebuchet MS', 'Impact', 'Comic Sans MS',
        'Tahoma', 'Courier', 'Lucida Console', 'Monaco', 'Helvetica',
    ];
}

function checkCanvasSupport(document) {
    try {
        return !!document.createElement('canvas');
    } catch (err) {
        return undefined;
    }
}

function checkWebglSupport(document) {
    try {
        const canvas = document.createElement('canvas');
        return !!canvas.getContext('webgl');
    } catch (err) {
        return undefined;
    }
}

function checkWebgl2Support(document) {
    try {
        const canvas = document.createElement('canvas');
        return !!canvas.getContext('webgl2');
    } catch (err) {
        return undefined;
    }
}

export {
    getWindow,
    getDocument,
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
}
