precision highp float;

uniform sampler2D images[numImages];
uniform vec2 shapes[numImages];
uniform vec2 viewShape;
uniform float tick;
uniform float speed;
uniform float smoothing;
uniform float smoothLimit;

varying vec2 uv;

const vec4 ndcRange = vec4(-1, -1, 1, 1);
const vec4 stRange = vec4(0, 0, 1, 1);

#pragma glslify: map = require('glsl-map');
#pragma glslify: noise = require('glsl-noise/simplex/2d');

#pragma glslify: aspectCover = require('./aspect/cover');
#pragma glslify: aspectContain = require('./aspect/contain');

void main() {
    vec2 st = map(uv, ndcRange.xy, ndcRange.zw, stRange.xy, stRange.zw);
    vec2 xy = uv/aspectCover(viewShape);

    float closestSq = 100000000.0;
    float cellIndex;
    float smoothed = 0.0;

    for(int i = 0; i < numCells; ++i) {
        float c = float(i);
        float t = tick*speed;
        vec2 center = vec2(noise(vec2(t, c*1234.5678)), noise(vec2(t, c*5678.1234)));
        vec2 toCenter = center-xy;
        float lengthSq = dot(toCenter, toCenter);

        // @todo Isolines as per IQ's voronoi: https://www.iquilezles.org/www/articles/voronoilines/voronoilines.htm
        closestSq = min(closestSq, lengthSq);
        cellIndex = mix(cellIndex, float(i), step(lengthSq, closestSq));

        #if defined(smoothing_power)
            smoothed += 1.0/pow(lengthSq, smoothing);
        #elif defined(smoothing_exponent)
            smoothed += exp(-smoothing*sqrt(lengthSq));
        #endif
    }

    #if defined(smoothing_power)
        smoothed = pow(1.0/smoothed, 1.0/(smoothing*2.0));
    #elif defined(smoothing_exponent)
        smoothed = -log(smoothed)/smoothing;
    #endif

    int imageIndex = int(mod(cellIndex, float(numImages)));
    vec4 image;

    for(int i = 0; i < numCells; ++i) {
        if(i == imageIndex) {
            vec2 shape = shapes[i];

            image = texture2D(images[i], st*aspectContain(shape/viewShape));

            break;
        }
    }

    #if defined(smoothing_power) || defined(smoothing_exponent)
        float smoothMix = clamp(0.0, 1.0, smoothed/smoothLimit);

        gl_FragColor = mix(image, vec4(0), smoothMix);
    #else
        gl_FragColor = image;
    #endif
}
