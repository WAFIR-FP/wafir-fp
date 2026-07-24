#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#ifdef __EMSCRIPTEN__
EM_JS(void, init_webgl_utils, (), {
  if (!globalThis.__fp_webgl) {
    globalThis.__fp_webgl = {
      writeToBuffer(buf, buf_len, value) {
        var len = lengthBytesUTF8(value) + 1;
        if (buf && buf_len > 0) stringToUTF8(value, buf, buf_len);
        return len;
      },
      getWindow() {
        if (typeof window !== "undefined") return window;
        return null;
      },
      getDocument() {
        if (typeof document !== "undefined") return document;
        var win = this.getWindow();
        if (win && win.document) return win.document;
        return null;
      },
      createContext() {
        var doc = this.getDocument();
        if (!doc) return null;

        var canvas = doc.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;

        var gl2 = canvas.getContext("webgl2");
        if (gl2) return { gl: gl2, version: "WebGL 2.0" };

        var gl1 = canvas.getContext("webgl");
        if (gl1) return { gl: gl1, version: "WebGL 1.0" };

        return null;
      }
    };
  }
});

EM_JS(void, init_webgl_functions, (), {
  if (!globalThis.__fp_webgl_fn) {
    globalThis.__fp_webgl_fn = {
      getVendorRenderer(gl) {
        var debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          return {
            vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "Unknown",
            renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "Unknown"
          };
        }
        return {
          vendor: gl.getParameter(gl.VENDOR) || "Unknown",
          renderer: gl.getParameter(gl.RENDERER) || "Unknown"
        };
      },
      getExtensions(gl) {
        var list = gl.getSupportedExtensions() || [];
        return Array.isArray(list) ? list : Array.from(list);
      },
      getViewport(gl) {
        var dims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
        if (Array.isArray(dims)) {
          return { width: Number(dims[0]) || 0, height: Number(dims[1]) || 0 };
        }
        if (dims && typeof dims.length === "number") {
          return { width: Number(dims[0]) || 0, height: Number(dims[1]) || 0 };
        }
        return { width: 0, height: 0 };
      },
      getShaderPrecision(gl, shaderType) {
        if (!gl.getShaderPrecisionFormat) return 0;
        var format = gl.getShaderPrecisionFormat(shaderType, gl.HIGH_FLOAT);
        return format ? format.precision : 0;
      },
      compileShader(gl, type, source) {
        var shader = gl.createShader(type);
        if (!shader) throw new Error("Falha ao criar shader");
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!compiled) {
          var info = gl.getShaderInfoLog(shader) || "Erro desconhecido ao compilar shader";
          gl.deleteShader(shader);
          throw new Error(info);
        }
        return shader;
      },
      linkProgram(gl, vertexShader, fragmentShader) {
        var program = gl.createProgram();
        if (!program) throw new Error("Falha ao criar programa WebGL");
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!linked) {
          var info = gl.getProgramInfoLog(program) || "Erro desconhecido ao linkar programa";
          gl.deleteProgram(program);
          throw new Error(info);
        }
        return program;
      },
      readPixelHash(gl) {
        var pixels = new Uint8Array(4 * 16 * 16);
        gl.readPixels(120, 120, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return Array.from(pixels.slice(0, 64))
          .map(function(value) { return value.toString(16).padStart(2, "0"); })
          .join("");
      },
      renderTestScene(gl) {
        var vertexShader = this.compileShader(
          gl,
          gl.VERTEX_SHADER,
          "\n\
        attribute vec2 aVertexPosition;\n\
        uniform mat4 uModelViewMatrix;\n\
        uniform mat4 uProjectionMatrix;\n\
        varying highp vec2 vTextureCoord;\n\
\n\
        void main(void) {\n\
            gl_Position = vec4(aVertexPosition, 0.0, 1.0);\n\
            vTextureCoord = aVertexPosition;\n\
        }\n\
        "
        );

        var fragmentShader = this.compileShader(
          gl,
          gl.FRAGMENT_SHADER,
          "\n\
        precision mediump float;\n\
        varying highp vec2 vTextureCoord;\n\
        uniform float uTime;\n\
\n\
        void main(void) {\n\
            float r = abs(sin(vTextureCoord.x * 10.0 + uTime));\n\
            float g = abs(cos(vTextureCoord.y * 10.0 + uTime));\n\
            float b = abs(sin((vTextureCoord.x + vTextureCoord.y) * 5.0));\n\
            gl_FragColor = vec4(r, g, b, 1.0);\n\
        }\n\
        "
        );

        var program = this.linkProgram(gl, vertexShader, fragmentShader);
        gl.useProgram(program);

        var vertices = new Float32Array([
          -1.0, -1.0,
           1.0, -1.0,
          -1.0,  1.0,
           1.0,  1.0
        ]);

        var vertexBuffer = gl.createBuffer();
        if (!vertexBuffer) throw new Error("Falha ao criar buffer WebGL");
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        var positionLocation = gl.getAttribLocation(program, "aVertexPosition");
        if (positionLocation === -1) throw new Error("Atributo aVertexPosition nao encontrado");
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);

        gl.viewport(0, 0, 256, 256);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        var hash = this.readPixelHash(gl);

        gl.deleteBuffer(vertexBuffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        return hash;
      },
      collectInfo() {
        var ctx = globalThis.__fp_webgl.createContext();
        if (!ctx) {
          return {
            version: "Unavailable",
            vendor: "Unavailable",
            renderer: "Unavailable",
            extensions: [],
            extensions_joined: "",
            max_texture_size: 0,
            max_viewport_width: 0,
            max_viewport_height: 0,
            vertex_precision: 0,
            fragment_precision: 0,
            shading_language_version: "Unavailable",
            render_hash: "",
            status: "unsupported",
            error_code: "WEBGL_CONTEXT_UNAVAILABLE"
          };
        }

        var gl = ctx.gl;
        var vendorRenderer = this.getVendorRenderer(gl);
        var extensions = this.getExtensions(gl);
        var viewport = this.getViewport(gl);
        var renderHash = "";

        try {
          renderHash = this.renderTestScene(gl);
        } catch (_) {
          renderHash = "";
        }

        return {
          version: ctx.version,
          vendor: vendorRenderer.vendor,
          renderer: vendorRenderer.renderer,
          extensions: extensions,
          extensions_joined: extensions.join(","),
          max_texture_size: gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0,
          max_viewport_width: viewport.width,
          max_viewport_height: viewport.height,
          vertex_precision: this.getShaderPrecision(gl, gl.VERTEX_SHADER),
          fragment_precision: this.getShaderPrecision(gl, gl.FRAGMENT_SHADER),
          shading_language_version: gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || "Unavailable",
          render_hash: renderHash,
          status: renderHash ? "ok" : "partial",
          error_code: renderHash ? null : "WEBGL_RENDER_FAILED"
        };
      }
    };
  }
});

EM_JS(int, get_webgl_info_json, (char *buf, int buf_len), {
  init_webgl_utils();
  init_webgl_functions();
  var info;
  try {
    info = globalThis.__fp_webgl_fn.collectInfo();
  } catch (error) {
    if (globalThis.console && typeof globalThis.console.error === "function") {
      globalThis.console.error("[C++/WASM] Falha inesperada na coleta WebGL", error);
    }
    info = {
      version: "Unavailable",
      vendor: "Unavailable",
      renderer: "Unavailable",
      extensions: [],
      extensions_joined: "",
      max_texture_size: 0,
      max_viewport_width: 0,
      max_viewport_height: 0,
      vertex_precision: 0,
      fragment_precision: 0,
      shading_language_version: "Unavailable",
      render_hash: "",
      status: "error",
      error_code: "UNEXPECTED_COLLECTION_ERROR"
    };
  }
  return globalThis.__fp_webgl.writeToBuffer(buf, buf_len, JSON.stringify(info));
});
#endif
