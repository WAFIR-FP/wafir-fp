const isPresent = (value) => value !== undefined && value !== null && value !== '';
const isKnownText = (value) => isPresent(value) && value !== 'Unknown' && value !== 'Unavailable';
const hasHash = (component) => component?.available !== false &&
    typeof component?.hash === 'string' && component.hash.length > 0;
const positiveBrowserFields = new Set([
    'hardware_concurrency',
    'screen_width',
    'screen_height',
    'screen_avail_width',
    'screen_avail_height',
    'screen_color_depth',
    'screen_pixel_depth',
    'pixel_ratio'
]);

const isComparableBrowserValue = (key, value) => {
    if (!isPresent(value)) return false;
    if (typeof value === 'string') return isKnownText(value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return false;
        return positiveBrowserFields.has(key) ? value > 0 : value >= 0 || key === 'timezone_offset';
    }
    return true;
};

const hasUnavailableWebGLMetadata = (webgl) => {
    if (!webgl || webgl.available === false) return true;
    const metadataKeys = ['version', 'vendor', 'renderer'];
    const suppliedMetadata = metadataKeys.filter(key => isPresent(webgl[key]));
    return suppliedMetadata.length > 0 && suppliedMetadata.every(key => !isKnownText(webgl[key]));
};

// Compara sinais estáveis para reconhecer ambientes entre navegadores.
class FingerprintMatcher {
    constructor() {
        this.weights = {
            canvas: 0.25,
            webgl: 0.20,
            audio: 0.10,
            browser: 0.45
        };

        this.thresholds = {
            exact_match: 0.95,
            same_device: 0.85,
            likely_same: 0.75,
            possibly_same: 0.65,
            different: 0.0,
            minimum_coverage: 0.50
        };
    }

    calculateSimilarityDetails(fp1, fp2) {
        if (!fp1 || !fp2) return { similarity: 0, coverage: 0 };

        let totalScore = 0;
        let totalWeight = 0;

        if (hasHash(fp1.canvas_fingerprint) && hasHash(fp2.canvas_fingerprint)) {
            totalScore += (fp1.canvas_fingerprint.hash === fp2.canvas_fingerprint.hash ? 1 : 0) * this.weights.canvas;
            totalWeight += this.weights.canvas;
        }

        if (this.hasComparableWebGL(fp1.webgl_fingerprint, fp2.webgl_fingerprint)) {
            totalScore += this.compareWebGL(fp1.webgl_fingerprint, fp2.webgl_fingerprint) * this.weights.webgl;
            totalWeight += this.weights.webgl;
        }

        if (hasHash(fp1.audio_fingerprint) && hasHash(fp2.audio_fingerprint)) {
            totalScore += (fp1.audio_fingerprint.hash === fp2.audio_fingerprint.hash ? 1 : 0) * this.weights.audio;
            totalWeight += this.weights.audio;
        }

        const browser1 = fp1.browser_fingerprint || fp1.browser_info;
        const browser2 = fp2.browser_fingerprint || fp2.browser_info;
        if (this.hasComparableBrowserFields(browser1, browser2)) {
            totalScore += this.compareBrowserFingerprint(browser1, browser2) * this.weights.browser;
            totalWeight += this.weights.browser;
        }

        return {
            similarity: totalWeight > 0 ? totalScore / totalWeight : 0,
            coverage: totalWeight
        };
    }

    calculateSimilarity(fp1, fp2) {
        return this.calculateSimilarityDetails(fp1, fp2).similarity;
    }

    hasComparableWebGL(webgl1, webgl2) {
        if (!webgl1 || !webgl2) return false;
        if (hasUnavailableWebGLMetadata(webgl1) || hasUnavailableWebGLMetadata(webgl2)) return false;
        return (isKnownText(webgl1.vendor) && isKnownText(webgl2.vendor)) ||
            (isKnownText(webgl1.renderer) && isKnownText(webgl2.renderer)) ||
            (hasHash(webgl1) && hasHash(webgl2));
    }

    compareWebGL(webgl1, webgl2) {
        if (!this.hasComparableWebGL(webgl1, webgl2)) return 0;
        let score = 0;
        let weight = 0;

        if (isKnownText(webgl1?.vendor) && isKnownText(webgl2?.vendor)) {
            score += webgl1.vendor === webgl2.vendor ? 0.5 : 0;
            weight += 0.5;
        }
        if (isKnownText(webgl1?.renderer) && isKnownText(webgl2?.renderer)) {
            score += webgl1.renderer === webgl2.renderer ? 0.4 : 0;
            weight += 0.4;
        }
        if (hasHash(webgl1) && hasHash(webgl2)) {
            score += webgl1.hash === webgl2.hash ? 0.1 : 0;
            weight += 0.1;
        }

        return weight > 0 ? score / weight : 0;
    }

    getBrowserComparisons(browser1, browser2) {
        if (!browser1 || !browser2) return [];
        if (browser1.available === false || browser2.available === false) return [];
        const comparisons = [];
        const unavailableFields = new Set([
            ...(Array.isArray(browser1.unavailable_fields) ? browser1.unavailable_fields : []),
            ...(Array.isArray(browser2.unavailable_fields) ? browser2.unavailable_fields : [])
        ]);
        const canCompare = key => !unavailableFields.has(key) &&
            isComparableBrowserValue(key, browser1[key]) &&
            isComparableBrowserValue(key, browser2[key]);
        const addEquality = (key, weight) => {
            if (canCompare(key)) {
                comparisons.push({ weight, match: browser1[key] === browser2[key] ? 1 : 0 });
            }
        };
        const addPair = (firstKey, secondKey, weight) => {
            if (canCompare(firstKey) && canCompare(secondKey)) {
                const matches = browser1[firstKey] === browser2[firstKey] && browser1[secondKey] === browser2[secondKey];
                comparisons.push({ weight, match: matches ? 1 : 0 });
            }
        };

        addEquality('platform', 3);
        addEquality('screen_resolution', 2.5);
        addPair('screen_width', 'screen_height', 2);
        addPair('screen_avail_width', 'screen_avail_height', 1.5);
        addEquality('screen_color_depth', 1);
        addEquality('screen_pixel_depth', 1);

        if (canCompare('pixel_ratio')) {
            comparisons.push({
                weight: 1.5,
                match: Math.abs(browser1.pixel_ratio - browser2.pixel_ratio) < 0.1 ? 1 : 0
            });
        }

        addEquality('hardware_concurrency', 2);
        addEquality('max_touch_points', 1);
        addEquality('timezone_offset', 1);
        addEquality('timezone', 1);
        addEquality('language', 0.5);

        if (!unavailableFields.has('languages') &&
            Array.isArray(browser1.languages) && browser1.languages.length > 0 &&
            Array.isArray(browser2.languages) && browser2.languages.length > 0) {
            comparisons.push({ weight: 0.5, match: this.compareArrays(browser1.languages, browser2.languages) });
        }

        const uaComparable = canCompare('user_agent');
        const ua1Family = uaComparable ? this.getUserAgentFamily(browser1.user_agent) : 'unknown';
        const ua2Family = uaComparable ? this.getUserAgentFamily(browser2.user_agent) : 'unknown';
        if (uaComparable && ua1Family !== 'unknown' && ua2Family !== 'unknown') {
            comparisons.push({ weight: 0.3, match: ua1Family === ua2Family ? 1 : 0 });
        }

        addEquality('canvas_support', 0.5);
        addEquality('webgl_support', 0.5);
        addEquality('webgl2_support', 0.5);
        addEquality('local_storage', 0.3);
        addEquality('indexed_db', 0.3);
        addEquality('cookie_enabled', 0.3);
        return comparisons;
    }

    hasComparableBrowserFields(browser1, browser2) {
        return this.getBrowserComparisons(browser1, browser2).length > 0;
    }

    compareBrowserFingerprint(browser1, browser2) {
        const comparisons = this.getBrowserComparisons(browser1, browser2);
        const total = comparisons.reduce((sum, item) => sum + item.weight, 0);
        const matches = comparisons.reduce((sum, item) => sum + item.match * item.weight, 0);
        return total > 0 ? matches / total : 0;
    }

    compareArrays(arr1, arr2) {
        if (!Array.isArray(arr1) || !Array.isArray(arr2)) return 0;
        if (arr1.length === 0 && arr2.length === 0) return 1;

        const set1 = new Set(arr1);
        const set2 = new Set(arr2);
        let intersection = 0;
        for (const item of set1) {
            if (set2.has(item)) intersection += 1;
        }
        const union = new Set([...set1, ...set2]).size;
        return union > 0 ? intersection / union : 0;
    }

    getUserAgentFamily(userAgent) {
        if (typeof userAgent !== 'string' || !userAgent) return 'unknown';
        if (userAgent.includes('Edg')) return 'Edge';
        if (userAgent.includes('OPR') || userAgent.includes('Opera')) return 'Opera';
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        return 'other';
    }

    isSameDevice(fp1, fp2) {
        const { similarity, coverage } = this.calculateSimilarityDetails(fp1, fp2);
        return coverage >= this.thresholds.minimum_coverage && similarity >= this.thresholds.same_device;
    }

    getMatchConfidence(similarity, coverage = 1) {
        if (coverage < this.thresholds.minimum_coverage) return 'insufficient';
        if (similarity >= this.thresholds.exact_match) return 'exact';
        if (similarity >= this.thresholds.same_device) return 'high';
        if (similarity >= this.thresholds.likely_same) return 'medium';
        if (similarity >= this.thresholds.possibly_same) return 'low';
        return 'none';
    }

    groupFingerprintsByDevice(fingerprints) {
        const parents = fingerprints.map((_, index) => index);
        const find = index => {
            while (parents[index] !== index) {
                parents[index] = parents[parents[index]];
                index = parents[index];
            }
            return index;
        };
        const union = (left, right) => {
            const leftRoot = find(left);
            const rightRoot = find(right);
            if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
        };

        for (let left = 0; left < fingerprints.length; left += 1) {
            const leftFingerprint = fingerprints[left].cpp_fingerprint || fingerprints[left].data || fingerprints[left];
            for (let right = left + 1; right < fingerprints.length; right += 1) {
                const rightFingerprint = fingerprints[right].cpp_fingerprint || fingerprints[right].data || fingerprints[right];
                if (this.isSameDevice(leftFingerprint, rightFingerprint)) union(left, right);
            }
        }

        const groupedByRoot = new Map();
        fingerprints.forEach((fingerprint, index) => {
            const root = find(index);
            if (!groupedByRoot.has(root)) groupedByRoot.set(root, []);
            groupedByRoot.get(root).push(fingerprint);
        });

        return [...groupedByRoot.values()].map((groupFingerprints, index) => ({
            userId: `user_${index + 1}`,
            fingerprints: groupFingerprints,
            sessions: new Set(groupFingerprints.map(fp => fp.sessionId).filter(Boolean))
        }));
    }

    calculateStatistics(logs) {
        if (!logs || logs.length === 0) {
            return {
                totalFingerprints: 0,
                totalSessions: 0,
                uniqueDevices: 0,
                returningDevices: 0,
                averageCollectionsPerDevice: 0,
                deviceGroups: []
            };
        }

        const userGroups = this.groupFingerprintsByDevice(logs);
        const uniqueDevices = userGroups.length;
        const totalFingerprints = logs.length;
        const totalSessions = new Set(logs.map(log => log.sessionId).filter(Boolean)).size;

        return {
            totalFingerprints,
            totalSessions,
            uniqueDevices,
            returningDevices: userGroups.filter(group => group.fingerprints.length > 1).length,
            averageCollectionsPerDevice: uniqueDevices > 0
                ? (totalFingerprints / uniqueDevices).toFixed(2)
                : 0,
            deviceGroups: userGroups.map(group => ({
                userId: group.userId,
                fingerprintCount: group.fingerprints.length,
                sessionCount: group.sessions.size,
                firstSeen: group.fingerprints[0].serverTimestamp,
                lastSeen: group.fingerprints[group.fingerprints.length - 1].serverTimestamp
            }))
        };
    }
}

export default FingerprintMatcher;
