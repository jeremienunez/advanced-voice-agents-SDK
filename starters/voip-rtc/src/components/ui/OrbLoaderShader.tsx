import { useEffect, useRef } from "react";

export function OrbLoaderShader({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) return;

    const vertexSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform vec2 resolution;
      uniform float time;

      float dotAt(vec2 p, vec2 c, float size) {
        return smoothstep(size, 0.0, length(p - c));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
        float phase = 0.5 + 0.5 * sin(time * 1.15);
        phase = smoothstep(0.12, 0.92, phase);
        vec3 blue = vec3(0.45, 0.66, 1.0);
        vec3 mint = vec3(0.48, 0.86, 0.68);
        vec3 gold = vec3(1.0, 0.82, 0.42);
        vec3 color = vec3(1.0);
        float alpha = 0.0;

        for (int i = 0; i < 34; i++) {
          float n = float(i);
          float a = n * 0.739 + time * 0.16;
          vec2 scatter = vec2(
            sin(n * 12.9898) * 0.76,
            cos(n * 7.233) * 0.52
          );
          vec2 ring = vec2(cos(a), sin(a)) * (0.31 + 0.05 * sin(n));
          vec2 pos = mix(scatter, ring, phase);
          float dot = dotAt(uv, pos, mix(0.020, 0.028, phase));
          vec3 accent = mix(blue, mint, fract(n * 0.31));
          accent = mix(accent, gold, smoothstep(0.70, 1.0, fract(n * 0.19)));
          color = mix(color, accent, dot * 0.72);
          alpha += dot * mix(0.18, 0.34, phase);
        }

        float core = smoothstep(0.38, 0.03, length(uv));
        float rim = smoothstep(0.38, 0.30, length(uv)) * smoothstep(0.18, 0.32, length(uv));
        color = mix(color, mix(vec3(1.0), blue, 0.22), core * phase * 0.28);
        alpha += core * phase * 0.10 + rim * phase * 0.18;
        gl_FragColor = vec4(color, min(alpha, 0.72));
      }
    `;

    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, "resolution");
    const time = gl.getUniformLocation(program, "time");
    const started = performance.now();
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const render = () => {
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, (performance.now() - started) * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);

  return <canvas aria-hidden="true" className={className || "orbLoaderShader"} ref={canvasRef} />;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
