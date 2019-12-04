import State from 'controls-state';
import merge from 'lodash-es/merge';
import { range, each } from 'array-utils';
import { positions as screenPositions, count } from '@epok.tech/gl-screen-triangle';

import vert from '@epok.tech/gl-screen-triangle/uv-ndc.vert.glsl';

import frag from './index.frag.glsl';

export const optionalExtensions = ['EXT_shader_texture_lod'];

export function getVoronoi(regl, { images, shapes, maxImages = images.length }) {
    const out = {
        vert,
        frag,
        maxImages,
        images,
        shapes
    };

    const state = out.state = State.Section({
        imageCount: State.Slider(16,
            { min: 1, max: regl.limits.maxTextureUnits, step: 1 }),

        cellCount: State.Slider(30, { min: 0, max: 100, step: 1 }),
        speed: State.Slider(0.1/60, { min: -2/60, max: 2/60, step: 0.01/60 }),
        distance: {
            style: State.Select('exp',
                { options: ['min', 'pow', 'exp', 'smin'] }),
            smooth: State.Slider(10, { min: -40, max: 40, step: 0.01 }),
            limit: State.Slider(0.1, { min: 0, max: 2, step: 0.01 }),

            // @todo Get these presets working:
            presets: State.Section({
                    pow: () => merge(state.distance,
                        { style: 'pow', smooth: 5, limit: 0.5 }),
                    exp: () => merge(state.distance,
                        { style: 'exp', smooth: 10, limit: 0.1 }),
                    smin: () => merge(state.distance,
                        { style: 'smin', smooth: 0.2, limit: 0.25 })
                },
                { enumerable: false, label: 'Presets' })
        },
        edge: {
            style: State.Select('smin',
                { options: ['none', 'min', 'pow', 'exp', 'smin'] }),
            smooth: State.Slider(0.06, { min: -40, max: 40, step: 0.01 }),
            size: State.Slider(0.006, { min: -1, max: 1, step: 0.001 }),

            // @todo Get these presets working:
            presets: State.Section({
                    pow: () => merge(state.distance, {
                        style: 'pow',
                        smooth: 7,
                        size: 0.03
                    }),
                    smin: () => merge(state.distance, {
                        style: 'smin',
                        smooth: 0.06,
                        size: 0.006
                    })
                },
                { enumerable: false, label: 'Presets' })
        },
        space: {
            style: State.Select('near',
                { options: ['none', 'near', 'pow', 'exp', 'smin'] }),
            bias: State.Slider(3, { min: -40, max: 40, step: 0.01 }),

            // @todo Get these presets working:
            presets: State.Section({
                    near: () => merge(state.distance, {
                        style: 'near',
                        bias: 3
                    }),
                    pow: () => merge(state.distance, {
                        style: 'pow',
                        bias: 20
                    }),
                    exp: () => merge(state.distance, {
                        style: 'exp',
                        bias: 40
                    })
                },
                { enumerable: false, label: 'Presets' })
        }
    });

    const cache = {
        props: {},
        viewShape: [0, 0]
    };

    const uniforms = out.uniforms = {
        tick: regl.context('tick'),
        viewShape: ({ viewportWidth: w, viewportHeight: h }) => {
            const { viewShape } = cache;

            viewShape[0] = w;
            viewShape[1] = h;

            return viewShape;
        },
        speed: regl.prop('state.speed'),
        distLimit: regl.prop('state.distance.limit'),
        distSmooth: regl.prop('state.distance.smooth'),
        edgeSmooth: regl.prop('state.edge.smooth'),
        edgeSize: regl.prop('state.edge.size'),
        spaceBias: regl.prop('state.space.bias')
    };

    each((v, i) => {
            uniforms[`images[${i}]`] = regl.prop(`images[${i}]`);
            uniforms[`shapes[${i}]`] = regl.prop(`shapes[${i}]`);
        },
        range(maxImages));

    const updateFrag = ({
            frag,
            state: {
                imageCount: i,
                cellCount: c,
                distance: { style: d },
                edge: { style: b },
                space: { style: s }
            }
        }) =>
        `#define imageCount ${i}\n`+
        `#define cellCount ${c}\n`+
        `#define distStyle distStyle_${d}\n`+
        `#define edgeStyle edgeStyle_${b}\n`+
        `#define spaceStyle spaceStyle_${s}\n`+
        '\n'+
        frag;

    const draw = regl({
        vert: regl.prop('vert'),
        frag: (c, props) => updateFrag(props),
        attributes: { position: screenPositions },
        uniforms,
        depth: { enable: false },
        count
    });

    out.draw = (props) => draw(Object.assign(cache.props, out, props));

    return out;
}

export default getVoronoi;
