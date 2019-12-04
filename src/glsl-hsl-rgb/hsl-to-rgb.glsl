const vec3 k = vec3(0.0, 4.0, 2.0);

vec3 hslToRGB(in float h, in float s, in float l) {
    vec3 rgb = clamp(abs(mod((h*6.0)+k, 6.0)-3.0)-1.0, 0.0, 1.0);

    return l+(s*(rgb-0.5)*(1.0-abs((2.0*l)-1.0)));
}

vec3 hslToRGB(in vec3 hsl) {
    return hslToRGB(hsl.x, hsl.y, hsl.z);
}

#pragma glslify: export(hslToRGB);
