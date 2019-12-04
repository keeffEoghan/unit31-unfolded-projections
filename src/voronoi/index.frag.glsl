// @todo Break all this up into smaller modules so we can split it across passes etc.

#ifdef GL_EXT_shader_texture_lod
    #extension GL_EXT_shader_texture_lod : enable
#endif

#define distStyle_min 0
#define distStyle_pow 1
#define distStyle_exp 2
#define distStyle_smin 3
#ifndef distStyle
    #define distStyle distStyle_smin
#endif

#define edgeStyle_min 0
#define edgeStyle_pow 1
#define edgeStyle_exp 2
#define edgeStyle_smin 3
#define edgeStyle_none 4
#ifndef edgeStyle
    #define edgeStyle edgeStyle_smin
#endif

#define spaceStyle_near 0
#define spaceStyle_pow 1
#define spaceStyle_exp 2
#define spaceStyle_smin 3
#define spaceStyle_none 4
#ifndef spaceStyle
    #define spaceStyle spaceStyle_near
#endif

precision highp float;

uniform sampler2D images[imageCount];
uniform vec3 shapes[imageCount];
uniform vec2 viewShape;
uniform float tick;
uniform float speed;
uniform float distLimit;

#if distStyle != distStyle_min
    uniform float distSmooth;

    #if distStyle == distStyle_pow
        #define smoothDistSumSq smoothPowSumSq
        #define smoothDistSum smoothPowSum
        #define smoothDistOut smoothPowOut
    #elif distStyle == distStyle_exp
        #define smoothDistSumSq smoothExpSumSq
        #define smoothDistSum smoothExpSum
        #define smoothDistOut smoothExpOut
    #elif distStyle == distStyle_smin
        #define smoothDistSumSq smoothMinSumSq
        #define smoothDistSum smoothMinSum
    #endif
#endif

#if edgeStyle != edgeStyle_none
    uniform float edgeSize;

    #if edgeStyle != edgeStyle_min
        uniform float edgeSmooth;

        #if edgeStyle == edgeStyle_pow
            #define smoothEdgeSumSq smoothPowSumSq
            #define smoothEdgeSum smoothPowSum
            #define smoothEdgeOut smoothPowOut
        #elif edgeStyle == edgeStyle_exp
            #define smoothEdgeSumSq smoothExpSumSq
            #define smoothEdgeSum smoothExpSum
            #define smoothEdgeOut smoothExpOut
        #elif edgeStyle == edgeStyle_smin
            // [See this `round voronoi` Shadertoy](https://www.shadertoy.com/view/ldXBDs)
            #define smoothEdgeSumSq smoothMinSumSq
            #define smoothEdgeSum smoothMinSum
        #endif
    #endif
#endif

#if spaceStyle != spaceStyle_none
    uniform float spaceBias;

    #if spaceStyle == spaceStyle_pow
        #define smoothSpaceSumSq smoothPowSumSq
        #define smoothSpaceSum smoothPowSum
        #define smoothSpaceOut smoothPowOut
    #elif spaceStyle == spaceStyle_exp
        #define smoothSpaceSumSq smoothExpSumSq
        #define smoothSpaceSum smoothExpSum
        #define smoothSpaceOut smoothExpOut
    #elif spaceStyle == spaceStyle_smin
        #define smoothSpaceSumSq smoothMinSumSq
        #define smoothSpaceSum smoothMinSum
    #endif
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
#pragma glslify: smin = require('../smooth-min.glsl');

const float epsilon = 0.0000001;
const float infinity = 100000000.0;

struct Voronoi {
    #if edgeStyle != edgeStyle_none
        float edge;
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

float getEdge(in vec2 pos, in vec2 cell0, in vec2 cell1, in vec2 nCell1ToCell0) {
    return dot(pos-(0.5*(cell0+cell1)), nCell1ToCell0);
}

float getEdge(in vec2 pos, in vec2 cell0, in vec2 cell1) {
    return getEdge(pos, cell0, cell1, normalize(cell0-cell1));
}


// [Smoothed voronoi as per IQ](https://www.iquilezles.org/www/articles/smoothvoronoi/smoothvoronoi.htm)

float smoothPowSumSq(in float sum, in float distSq, in float smoothing) {
    return sum+(1.0/pow(distSq, smoothing));
}

float smoothPowSum(in float sum, in float dist, in float smoothing) {
    return smoothPowSumSq(sum, dist*dist, smoothing);
}

float smoothPowOut(in float sum, in float smoothing) {
    return pow(1.0/sum, 1.0/(smoothing*2.0));
}

float smoothExpSum(in float sum, in float dist, in float smoothing) {
    return sum+exp(-smoothing*dist);
}

float smoothExpSumSq(in float sum, in float distSq, in float smoothing) {
    return smoothExpSum(sum, sqrt(distSq), smoothing);
}

float smoothExpOut(in float sum, in float smoothing) {
    return (-1.0/smoothing)*log(sum);
}

float smoothMinSum(in float sum, in float dist, in float smoothing) {
    return smin(sum, dist, smoothing);
}

float smoothMinSumSq(in float sum, in float distSq, in float smoothing) {
    return smin(sum, distSq, smoothing);
}

Voronoi getVoronoi(in vec2 pos) {
    float distSq0 = infinity;
    float index0;
    vec2 cell0;

    #if distStyle != distStyle_min
        float distSum;
    #endif

    #if edgeStyle != edgeStyle_none
        float edge = infinity;
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

        #if distStyle != distStyle_min
            distSum = smoothDistSumSq(distSum, distSqI, distSmooth);
        #endif
    }

    #if edgeStyle != edgeStyle_none
        // [Edges as per IQ's 2-pass voronoi, skipping current cell](https://www.iquilezles.org/www/articles/voronoilines/voronoilines.htm)
        for(int i = 1; i < cellCount; ++i) {
            vec2 cellI = getCell(mod(index0+float(i), float(cellCount)));
            vec2 cellIToCell0 = cell0-cellI;
            float l = length(cellIToCell0);
            float edgeI = getEdge(pos, cell0, cellI, cellIToCell0/l);

            #if edgeStyle == edgeStyle_min
                edge = min(edge, edgeI);
            #else
                edge = smoothEdgeSum(edge, edgeI, edgeSmooth);
            #endif

            #if spaceStyle == spaceStyle_near
                space += pow(l, spaceBias);
            #elif spaceStyle != spaceStyle_none
                space = smoothSpaceSum(space, l, spaceBias);
            #endif
        }
    #elif spaceStyle != spaceStyle_none
        for(int i = 1; i < cellCount; ++i) {
            vec2 cellI = getCell(mod(index0+float(i), float(cellCount)));
            float l = distance(cell0, cellI);

            #if spaceStyle == spaceStyle_near
                space += pow(l, spaceBias);
            #else
                space = smoothSpaceSum(space, l, spaceBias);
            #endif
        }
    #endif

    return Voronoi(
        #if edgeStyle != edgeStyle_none
            #if edgeStyle == edgeStyle_min || edgeStyle == edgeStyle_smin
                edge,
            #else
                smoothEdgeOut(edge, edgeSmooth),
            #endif
        #endif

        #if spaceStyle == spaceStyle_near
            space/float(cellCount),
        #elif spaceStyle == spaceStyle_smin
            space,
        #elif spaceStyle != spaceStyle_none
            smoothSpaceOut(space, spaceBias),
        #endif

        #if distStyle == distStyle_min
            sqrt(distSq0),
        #elif distStyle == distStyle_smin
            sqrt(distSum),
        #else
            smoothDistOut(distSum, distSmooth),
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
                image = texture2DLodEXT(images[i], uv, clamp(lod, 0.0, 1.0)*nLOD);
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
    return bezier(1.0, 0.0, 1.0, 0.0, space);
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

    #if edgeStyle != edgeStyle_none
        float edge = step(0.0, voronoi.edge-edgeSize);
    #else
        float edge = 1.0;
    #endif

    #if spaceStyle != spaceStyle_none
        vec4 image = getImage(imageIndex, st, spaceToLOD(voronoi.space));
        float colorBump = spaceToColor(voronoi.space);
        vec3 hsl = rgbToHSL(image.rgb);
        vec4 rgba = vec4(hslToRGB(hsl.x, min(hsl.y+colorBump, 0.0), hsl.z), image.a);

        float fill = spaceToFill(voronoi.space);

        // gl_FragColor = mix(vec4(0), rgba,
        //     clamp(mix((1.0-dist)+fill, edge, fill), 0.0, 1.0));
        // gl_FragColor = vec4(fill, 1.0-dist, edge, 1.0);
        gl_FragColor = vec4(voronoi.space, 0.0, edge, 1.0);
    #else
        vec4 image = getImage(imageIndex, st);

        gl_FragColor = mix(vec4(0), image, (1.0-dist)*edge);
    #endif
}
