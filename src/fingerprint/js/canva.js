import { drawFingerprintScene } from "./canvaUtils.js"
import { getDocument } from "./domUtils.js"

class CanvaFingerprint {
    static collect() {

        const document = getDocument()
        const canvas = document.createElement('canvas')
        
        canvas.width = 280
        canvas.height = 60

        const ctx = canvas.getContext('2d')
        if (!ctx) {
            throw new Error('Failed to get 2d context')
        }

        drawFingerprintScene(ctx)

        return canvas.toDataURL()
    }
}

export function getCanvaFingerprint() {
    return CanvaFingerprint.collect()
}
