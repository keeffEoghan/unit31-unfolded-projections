// @see https://github.com/glslify/glsl-smooth-min/issues/2
float smin(float a, float b, float k) {
    float h = max(k-abs(a-b), 0.0)/k;

    return min(a, b)-(h*h*h*k*(1.0/6.0));
}

#pragma glslify: export(smin);
