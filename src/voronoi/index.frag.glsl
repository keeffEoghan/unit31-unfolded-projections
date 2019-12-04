// @todo Break all this up into smaller modules so we can split it across passes etc.

#ifdef GL_EXT_shader_texture_lod
    #extension GL_EXT_shader_texture_lod : enable
#endif

#define smoothingStyle_none 0
#define smoothingStyle_power 1
#define smoothingStyle_exponent 2
#ifndef smoothingStyle
    #define smoothingStyle smoothingStyle_exponent
#endif

#define borderStyle_none 0
#define borderStyle_pass2Skip 1
#define borderStyle_pass2 2
#ifndef borderStyle
    #define borderStyle borderStyle_pass2Skip
#endif

#define spaceStyle_none 0
#define spaceStyle_nearby 1
#ifndef spaceStyle
    #define spaceStyle spaceStyle_nearby
#endif

precision highp float;

uniform sampler2D images[imageCount];
uniform vec3 shapes[imageCount];
uniform vec2 viewShape;
uniform float tick;
uniform float speed;
uniform float distLimit;

#if smoothingStyle != smoothingStyle_none
    uniform float smoothing;
#endif
#if borderStyle != borderStyle_none
    uniform float borderSize;
#endif
#if spaceStyle != spaceStyle_none
    uniform float nearBias;
#endif

varying vec2 uv;

const vec4 ndcRange = vec4(-1, -1, 1, 1);
const vec4 stRange = vec4(0, 0, 1, 1);

#pragma glslify: map = require('glsl-map');
#pragma glslify: noise = require('glsl-noise/simplex/2d');
#pragma glslify: aspectCover = require('glsl-aspect/cover');
#pragma glslify: aspectContain = require('glsl-aspect/contain');
#pragma glslify: bezier = require('bezier-gen/1d');

#pragma glslify: rgbToHSL = require('../glsl-hsl-rgb/rgb-to-hsl');
#pragma glslify: hslToRGB = require('../glsl-hsl-rgb/hsl-to-rgb');

const float epsilon = 0.0000001;
const float infinity = 100000000.0;

struct Voronoi {
    #if borderStyle != borderStyle_none
        float border;
    #endif

    #if spaceStyle != spaceStyle_none
        float space;
    #endif

    float dist;
    vec2 cell;
    float index;
};

// @todo Replace this with a more interesting movement.
// @todo Replace this with lookup into points buffer.
vec2 getCell(in float index) {
    float t = tick*speed;

    return vec2(noise(vec2(t, index*1234.5678)), noise(vec2(t, index*5678.1234)));
}

vec2 getCell(in int index) {
    return getCell(float(index));
}

float getBorder(in vec2 pos, in vec2 cell0, in vec2 cell1, in vec2 nCell1ToCell0) {
    return dot(pos-(0.5*(cell0+cell1)), nCell1ToCell0);
}

float getBorder(in vec2 pos, in vec2 cell0, in vec2 cell1) {
    return getBorder(pos, cell0, cell1, normalize(cell0-cell1));
}

Voronoi getVoronoi(in vec2 pos) {
    float distSq0 = infinity;
    float dist;
    float index0;
    vec2 cell0;

    #if borderStyle != borderStyle_none
        float border = infinity;
    #endif

    #if spaceStyle != spaceStyle_none
        // Approximate space/crowding/area heuristic.
        float space;
    #endif

    for(int i = 0; i < cellCount; ++i) {
        vec2 cellI = getCell(i);
        vec2 posToCellI = cellI-pos;
        float distSqI = dot(posToCellI, posToCellI);

        if(distSqI < distSq0) {
            index0 = float(i);
            cell0 = cellI;
            distSq0 = distSqI;
        }

        // [Smoothed voronoi as per IQ](https://www.iquilezles.org/www/articles/smoothvoronoi/smoothvoronoi.htm)
        #if smoothingStyle == smoothingStyle_power
            dist += 1.0/pow(distSqI, smoothing);
        #elif smoothingStyle == smoothingStyle_exponent
            dist += exp(-smoothing*sqrt(distSqI));
        #endif
    }

    #if borderStyle == borderStyle_pass2
        // [Borders as per IQ's 2-pass voronoi](https://www.iquilezles.org/www/articles/voronoilines/voronoilines.htm)
        for(int i = 0; i < cellCount; ++i) {
            vec2 cellI = getCell(i);
            vec2 cellIToCell0 = cell0-cellI;
            float lSq = dot(cellIToCell0, cellIToCell0);

            if(lSq > epsilon) {
                float l = sqrt(lSq);

                border = min(border,
                    getBorder(pos, cell0, cellI, cellIToCell0/l));

                #if spaceStyle == spaceStyle_nearby
                    space += pow(l, nearBias);
                #endif
            }
        }
    #elif borderStyle == borderStyle_pass2Skip
        // [Borders as per IQ's 2-pass voronoi, skipping current cell](https://www.iquilezles.org/www/articles/voronoilines/voronoilines.htm)
        for(int i = 1; i < cellCount; ++i) {
            vec2 cellI = getCell(mod(index0+float(i), float(cellCount)));
            vec2 cellIToCell0 = cell0-cellI;
            float l = length(cellIToCell0);

            border = min(border,
                getBorder(pos, cell0, cellI, cellIToCell0/l));

            #if spaceStyle == spaceStyle_nearby
                space += pow(l, nearBias);
            #endif
        }
    #elif spaceStyle == spaceStyle_nearby
        for(int i = 1; i < cellCount; ++i) {
            vec2 cellI = getCell(mod(index0+float(i), float(cellCount)));

            space += pow(distance(cell0, cellI), nearBias);
        }
    #endif

    return Voronoi(
        #if borderStyle != borderStyle_none
            border,
        #endif

        #if spaceStyle != spaceStyle_none
            space/float(cellCount),
        #endif

        #if smoothingStyle == smoothingStyle_power
            pow(1.0/dist, 1.0/(smoothing*2.0)),
        #elif smoothingStyle == smoothingStyle_exponent
            -log(dist)/smoothing,
        #else
            sqrt(distSq0),
        #endif

        cell0,
        index0
    );
}

/**
 * The number of mipmap levels-of-detail an image of the given size should have.
 *
 * @see https://stackoverflow.com/a/25640078/716898
 * @see https://www.gamedev.net/forums/topic/621709-query-number-of-mipmap-levels/
 */
float countImageLODs(in float w, in float h) {
    return floor(log2(max(w, h)))+1.0;
    // return floor(log2(max(w, h)))-1.0;
}

float countImageLODs(in vec2 shape) {
    return countImageLODs(shape.x, shape.y);
}

vec4 getImage(in int index, in vec2 st, in float lod) {
    // @todo Replace with texture atlas lookup - will cut out these loops anyway
    vec4 image;

    for(int i = 0; i < imageCount; ++i) {
        if(i == index) {
            vec3 shape = shapes[i];
            vec2 uv = st*aspectContain(shape.xy/viewShape);
            // float nLOD = countImageLODs(shape);
            float nLOD = shape.z;

            #ifdef GL_EXT_shader_texture_lod
                image = texture2DLodEXT(images[i], uv, lod*nLOD);
            #else
                // The `bias` argument is in the range [-1, 1] and influences the `mix`
                // between 2 already-defined levels-of-detail.
                image = texture2D(images[i], uv, -1.0+(lod*nLOD));
            #endif

            break;
        }
    }

    return image;
}

vec4 getImage(in int index, in vec2 st) {
    return getImage(index, st, 0.0);
}

vec4 getImage(in float index, in vec2 st, in float lod) {
    return getImage(int(index), st, lod);
}

vec4 getImage(in float index, in vec2 st) {
    return getImage(int(index), st);
}

float spaceToLOD(in float space) {
    return bezier(1.0, 0.0, 1.0, 0.0, clamp(space, 0.0, 1.0));
}

float spaceToColor(in float space) {
    float k0 = 0.0;
    float k1 = 0.5;
    float k2 = 1.0;

    float k0k1 = k1-k0;
    float k1k2 = k2-k1;

    return (bezier(0.0, 1.0, 0.0, 1.0, clamp(space, k0, k1))*k0k1)+
        (bezier(0.0, 1.0, 0.0, 1.0, clamp(space, k1, k2))*k1k2);
}

float spaceToFill(in float space) {
    float k0 = 0.0;
    float k1 = 0.5;
    float k2 = 1.0;

    float k0k1 = k1-k0;
    float k1k2 = k2-k1;

    return (bezier(0.0, 1.0, 0.0, 1.0, clamp(space, k0, k1))*k0k1)+
        (bezier(0.0, 1.0, 0.0, 1.0, clamp(space, k1, k2))*k1k2);
}

void main() {
    vec2 st = map(uv, ndcRange.xy, ndcRange.zw, stRange.xy, stRange.zw);
    vec2 xy = uv*aspectCover(1.0/viewShape);

    Voronoi voronoi = getVoronoi(xy);

    float dist = clamp(voronoi.dist/distLimit, 0.0, 1.0);
    int imageIndex = int(mod(voronoi.index, float(imageCount)));

    #if borderStyle != borderStyle_none
        float border = step(0.0, voronoi.border-borderSize);
    #else
        float border = 1.0;
    #endif

    #if spaceStyle != spaceStyle_none
        vec4 image = getImage(imageIndex, st, spaceToLOD(voronoi.space));
        float colorBump = spaceToColor(voronoi.space);
        vec3 hsl = rgbToHSL(image.rgb);
        vec4 rgba = vec4(hslToRGB(hsl.x, min(hsl.y+colorBump, 0.0), hsl.z), image.a);

        float fill = spaceToFill(voronoi.space);

        gl_FragColor = mix(vec4(0), rgba,
            clamp(mix((1.0-dist)+fill, border, fill), 0.0, 1.0));
    #else
        vec4 image = getImage(imageIndex, st);

        gl_FragColor = mix(vec4(0), image, (1.0-dist)*border);
    #endif
}
