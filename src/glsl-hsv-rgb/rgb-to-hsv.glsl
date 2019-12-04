const vec4 k = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);

vec3 rgbToHSV(in vec3 rgb) {
    vec4 p = mix(vec4(rgb.bg, k.wz), vec4(rgb.gb, k.xy), step(rgb.b, rgb.g));
    vec4 q = mix(vec4(p.xyw, rgb.r), vec4(rgb.r, p.yzx), step(p.x, rgb.r));

    float d = q.x-min(q.w, q.y);
    float e = 1.0e-10;

    return vec3(abs(q.z+(q.w-q.y)/((6.0*d)+e)), d/(q.x+e), q.x);
}

vec3 rgbToHSV(in float r, in float g, in float b) {
    return rgbToHSV(vec3(r, g, b));
}

#pragma glslify: export(rgbToHSV);
