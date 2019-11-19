#pragma glslify: aspect = require('./index');

vec2 aspectContain(in vec2 size) {
    return aspect(size, min(size.x, size.y));
}

#pragma glslify: export(aspectContain)
