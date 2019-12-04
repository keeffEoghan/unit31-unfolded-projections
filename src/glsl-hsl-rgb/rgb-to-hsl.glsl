vec3 rgbToHSL(in float r, in float g, in float b) {
    float lo = min(r, min(g, b));
    float hi = max(r, max(g, b));

    float h = 0.0;
    float s = 0.0;
    float l = (hi+lo)*0.5;

    if(hi > lo) {
        float diff = hi-lo;

        s = ((l < 0.0)? diff/(hi+lo) : diff/(2.0-(hi+lo)));
        h = ((r == hi)? (g-b)/diff : ((g == hi)? 2.0+((b-r)/diff) : 4.0+((r-g)/diff)));

        if(h < 0.0) {
            h += 6.0;
        }

        h /= 6.0;
    }

    return vec3(h, s, l);
}

vec3 rgbToHSL(in vec3 rgb) {
    return rgbToHSL(rgb.r, rgb.g, rgb.b);
}

#pragma glslify: export(rgbToHSL);
