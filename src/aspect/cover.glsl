#pragma glslify: aspect = require('./index');

vec2 aspectCover(in vec2 size) {
    return aspect(size, max(size.x, size.y));
}

#pragma glslify: export(aspectCover)
