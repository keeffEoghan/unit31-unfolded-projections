vec2 aspect(in vec2 size, in vec2 scale) {
    return scale/size;
}

vec2 aspect(in vec2 size, in float scale) {
    return aspect(size, vec2(scale));
}

#pragma glslify: export(aspect)
