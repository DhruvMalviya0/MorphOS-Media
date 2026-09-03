#version 330
in vec2 v_uv;
in float v_depth;
in float v_is_fg;

out vec4 f_color;

uniform sampler2D TextureBg;
uniform sampler2D TextureFg;
uniform float u_time;
uniform float u_windStrength;
uniform float u_rippleStrength;
uniform vec2 u_rippleCenter;

// Random noise generator
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
    vec2 final_uv = v_uv;
    
    // --- Wind Effect (Fragment distortion) ---
    // Apply scrolling UV noise if it's foreground, simulating hair/cloth movement
    if (v_is_fg > 0.5 && u_windStrength > 0.0) {
        float wind_wave = sin(v_uv.y * 10.0 + u_time * 5.0) * 0.005 * u_windStrength;
        float wind_noise = (rand(v_uv * 10.0 + vec2(u_time * 0.1)) - 0.5) * 0.002 * u_windStrength;
        final_uv.x += wind_wave + wind_noise;
    }
    
    // --- Ripple Effect ---
    // Apply radial sine wave from a point (for background/foreground)
    if (u_rippleStrength > 0.0) {
        vec2 d = v_uv - u_rippleCenter;
        float dist = length(d);
        float ripple = sin(dist * 50.0 - u_time * 10.0) * 0.01 * u_rippleStrength;
        // Dampen ripple over distance
        ripple *= max(1.0 - (dist * 2.0), 0.0);
        final_uv += (d / (dist + 0.0001)) * ripple;
    }
    
    // Read textures
    vec4 bg_col = texture(TextureBg, final_uv);
    vec4 fg_col = texture(TextureFg, final_uv);
    
    // Composite: if the mask is 1.0, we use foreground, else background
    if (v_is_fg > 0.5) {
        // We use fg_col RGB, and we assume it has alpha channel (or we rely entirely on v_is_fg)
        f_color = vec4(fg_col.rgb, 1.0);
    } else {
        f_color = vec4(bg_col.rgb, 1.0);
    }
}
