const vec4 k = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);

vec3 hsvToRGB(in vec3 hsv) {
    vec3 p = abs((fract(hsv.xxx+k.xyz)*6.0)-k.www);

    return hsv.z*mix(k.xxx, clamp(p-k.xxx, 0.0, 1.0), hsv.y);
}

vec3 hsvToRGB(in float h, in float s, in float v) {
    return hsvToRGB(vec3(h, s, v));
}

#pragma glslify: export(hsvToRGB);
