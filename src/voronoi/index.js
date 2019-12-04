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
        speed: State.Slider(1/60, { min: -2/60, max: 2/60, step: 0.01/60 }),
        distance: {
            style: State.Select('exp',
                { options: ['min', 'pow', 'exp', 'smin'] }),
            smooth: State.Slider(27, { min: -40, max: 40, step: 0.01 }),
            limit: State.Slider(0.01, { min: 0, max: 2, step: 0.01 }),

            // @todo Get these presets working:
            /*presets: State.Section({
                    pow: () => merge(state.distance,
                        { style: 'pow', smooth: 5, limit: 0.5 }),
                    exp: () => merge(state.distance,
                        { style: 'exp', smooth: 10, limit: 0.1 }),
                    smin: () => merge(state.distance,
                        { style: 'smin', smooth: 0.2, limit: 0.25 })
                },
                { enumerable: false, label: 'Presets' })*/
        },
        edge: {
            style: State.Select('smin',
                { options: ['none', 'min', 'pow', 'exp', 'smin'] }),
            smooth: State.Slider(0.03, { min: -40, max: 40, step: 0.01 }),
            size: State.Slider(0.001, { min: -1, max: 1, step: 0.001 }),
            fade: State.Slider(0.001, { min: -10, max: 10, step: 0.001 }),
            vignette: State.Slider(0.18, { min: -5, max: 5, step: 0.001 }),

            // @todo Get these presets working:
            /* presets: State.Section({
                    pow: () => merge(state.distance, {
                        style: 'pow',
                        smooth: 7,
                        size: 0.03
                    }),
                    smin: () => merge(state.distance, {
                        style: 'smin',
                        smooth: 0.04,
                        size: 0.004
                    })
                },
                { enumerable: false, label: 'Presets' }) */
        },
        space: {
            style: State.Select('exp',
                { options: ['none', 'near', 'pow', 'exp', 'smin'] }),
            bias: State.Slider(7, { min: -40, max: 40, step: 0.01 }),

            // @todo Get these presets working:
            /* presets: State.Section({
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
                        bias: 7
                    })
                },
                { enumerable: false, label: 'Presets' }) */
        },
        draw: {
            test: false,
            red: State.Slider(1, { min: 0, max: 1, step: 0.01 }),
            green: State.Slider(1, { min: 0, max: 1, step: 0.01 }),
            blue: State.Slider(1, { min: 0, max: 1, step: 0.01 }),
            alpha: State.Slider(1, { min: 0, max: 1, step: 0.01 })

            // test: true,
            // red: State.Slider(0, { min: 0, max: 1, step: 0.01 }),
            // green: State.Slider(0, { min: 0, max: 1, step: 0.01 }),
            // blue: State.Slider(1, { min: 0, max: 1, step: 0.01 }),
            // alpha: State.Slider(1, { min: 0, max: 1, step: 0.01 })
        }
    });

    const cache = {
        props: {},
        viewShape: [],
        edgeFade: [],
        mask: []
    };

    const uniforms = out.uniforms = {
        tick: regl.context('tick'),
        time: regl.context('time'),
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
        edgeFade: (c, { state: { edge: { fade: f, vignette: v } } }) => {
            const { edgeFade } = cache;

            edgeFade[0] = f;
            edgeFade[1] = v;

            return edgeFade;
        },
        spaceBias: regl.prop('state.space.bias'),
        mask: (c, { state: { draw: { red: r, green: g, blue: b, alpha: a } } }) => {
            const { mask } = cache;

            mask[0] = r;
            mask[1] = g;
            mask[2] = b;
            mask[3] = a;

            return mask;
        }
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
                space: { style: s },
                draw: { test: t }
            }
        }) =>
        `#define imageCount ${i}\n`+
        `#define cellCount ${c}\n`+
        `#define distStyle distStyle_${d}\n`+
        `#define edgeStyle edgeStyle_${b}\n`+
        `#define spaceStyle spaceStyle_${s}\n`+
        ((t)? `#define drawTest\n` : '')+
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
