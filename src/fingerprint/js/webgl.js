import { getDocument } from "./webglUtils.js"

function getVendorRenderer(gl) {
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
        return {
            vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) ?? "Unknown",
            renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? "Unknown",
        };
    }

    return {
        vendor: gl.getParameter(gl.VENDOR) ?? "Unknown",
        renderer: gl.getParameter(gl.RENDERER) ?? "Unknown",
    };
}

function getExtensions(gl) {
    const list = gl.getSupportedExtensions() ?? [];
    return Array.isArray(list) ? list : Array.from(list);
}

function getViewport(gl) {
    const dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    if (Array.isArray(dims)) {
        return { width: Number(dims[0]) || 0, height: Number(dims[1]) || 0 };
    }
    if (dims && typeof dims.length === "number") {
        return {
            width: Number(dims[0]) || 0,
            height: Number(dims[1]) || 0,
        };
    }
    return { width: 0, height: 0 };
}

function getShaderPrecision(gl, shaderType) {
    if (!gl.getShaderPrecisionFormat) {
        return 0;
    }
    const format = gl.getShaderPrecisionFormat(shaderType, gl.HIGH_FLOAT);
    return format ? format.precision : 0;
}

function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) {
        throw new Error("Falha ao criar shader");
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!compiled) {
        const info = gl.getShaderInfoLog(shader) || "Erro desconhecido ao compilar shader";
        gl.deleteShader(shader);
        throw new Error(info);
    }
    return shader;
}

function linkProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    if (!program) {
        throw new Error("Falha ao criar programa WebGL");
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
        const info = gl.getProgramInfoLog(program) || "Erro desconhecido ao linkar programa";
        gl.deleteProgram(program);
        throw new Error(info);
    }
    return program;
}

function readPixelHash(gl) {
    const pixels = new Uint8Array(4 * 16 * 16);
    gl.readPixels(120, 120, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return Array.from(pixels.slice(0, 64))
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
}

function renderTestScene(gl) {
    const vertexShader = compileShader(
        gl,
        gl.VERTEX_SHADER,
        `
        attribute vec2 aVertexPosition;
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        varying highp vec2 vTextureCoord;

        void main(void) {
            gl_Position = vec4(aVertexPosition, 0.0, 1.0);
            vTextureCoord = aVertexPosition;
        }
        `,
    );

    const fragmentShader = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        `
        precision mediump float;
        varying highp vec2 vTextureCoord;
        uniform float uTime;

        void main(void) {
            float r = abs(sin(vTextureCoord.x * 10.0 + uTime));
            float g = abs(cos(vTextureCoord.y * 10.0 + uTime));
            float b = abs(sin((vTextureCoord.x + vTextureCoord.y) * 5.0));
            gl_FragColor = vec4(r, g, b, 1.0);
        }
        `,
    );

    const program = linkProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(program);

    const vertices = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0,
    ]);

    const vertexBuffer = gl.createBuffer();
    if (!vertexBuffer) {
        throw new Error("Falha ao criar buffer WebGL");
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "aVertexPosition");
    if (positionLocation === -1) {
        throw new Error("Atributo aVertexPosition não encontrado");
    }
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLocation);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return readPixelHash(gl);
}

function collectInfo(gl, versionLabel) {
    const { vendor, renderer } = getVendorRenderer(gl);
    const extensions = getExtensions(gl);
    const viewport = getViewport(gl);
    let renderHash = "";
    let renderError = null;

    try {
        renderHash = renderTestScene(gl);
    } catch (error) {
        renderError = error?.message || "Falha ao renderizar a cena WebGL";
    }

    return {
        version: versionLabel,
        vendor,
        renderer,
        extensions,
        max_texture_size: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        max_viewport_width: viewport.width,
        max_viewport_height: viewport.height,
        vertex_precision: getShaderPrecision(gl, gl.VERTEX_SHADER),
        fragment_precision: getShaderPrecision(gl, gl.FRAGMENT_SHADER),
        shading_language_version: gl.getParameter(gl.SHADING_LANGUAGE_VERSION) ?? "Unknown",
        render_hash: renderHash,
        render_error: renderError,
    };
}

class WebGlFingerprint {
    static collect() {
        const doc = getDocument();
        const canvas = doc.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;

        const gl2 = canvas.getContext("webgl2");
        if (gl2) {
            return collectInfo(gl2, "WebGL 2.0");
        }

        const gl1 = canvas.getContext("webgl");
        if (gl1) {
            return collectInfo(gl1, "WebGL 1.0");
        }

        throw new Error("WebGL não suportado");
    }
}

export function getWebGlFingerprint() {
    return WebGlFingerprint.collect();
}
