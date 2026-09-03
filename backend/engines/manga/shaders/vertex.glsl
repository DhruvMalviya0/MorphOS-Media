#version 330
in vec2 in_vert;
in vec2 in_uv;

out vec2 v_uv;
out float v_depth;
out float v_is_fg;

uniform sampler2D TextureDepth;
uniform sampler2D TextureMask;
uniform mat4 Mvp;
uniform float u_time;
uniform float u_depthStrength;

void main() {
    v_uv = in_uv;
    
    // Sample depth (normalized 0.0 to 1.0)
    vec4 depthColor = texture(TextureDepth, in_uv);
    float depth = depthColor.r; // Assuming grayscale depth map
    v_depth = depth;
    
    // Sample mask (0.0 = bg, 1.0 = fg)
    vec4 maskColor = texture(TextureMask, in_uv);
    float is_fg = maskColor.r;
    v_is_fg = is_fg;
    
    // Displace Z coordinate for Parallax
    // Foreground (closer) -> higher Z. Background -> lower Z
    float z = (depth - 0.5) * u_depthStrength;
    
    // Apply "Breathing" effect to foreground vertices
    // A slow sine wave on the Y-axis
    float breath = 0.0;
    if (is_fg > 0.5) {
        breath = sin(u_time * 2.0) * 0.01; // 0.01 amplitude
    }
    
    vec3 pos = vec3(in_vert, z);
    pos.y += breath;
    
    gl_Position = Mvp * vec4(pos, 1.0);
}
