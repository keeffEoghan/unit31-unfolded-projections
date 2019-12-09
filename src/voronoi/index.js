import State from 'controls-state';
import merge from 'lodash-es/merge';
import { range, each, reduce } from 'array-utils';
import { positions as screenPositions, count } from '@epok.tech/gl-screen-triangle';

import vert from '@epok.tech/gl-screen-triangle/uv-ndc.vert.glsl';

import frag from './index.frag.glsl';

export const optionalExtensions = ['EXT_shader_texture_lod'];

export function getVoronoi(regl, { images, shapes, maxImages = images.length, mask }) {
    const out = {
        vert,
        frag,
        maxImages,
        images,
        shapes,
        mask
    };

    // @todo Rethink this setup, object's copied into `controls-state`, lost reference.
    const state = out.state = State.Section({
        imageScale: State.Slider(0.4, { min: 0, max: 10, step: 0.01 }),
        imageCount: State.Slider(15, { min: 1, max: maxImages, step: 1 }),
        // cellCount: State.Slider(0, { min: 0, max: 100, step: 1 }),
        cellCount: State.Slider(20, { min: 0, max: 100, step: 1 }),
        maskStrength: State.Slider(2, { min: 0, max: 10, step: 0.001 }),
        speed: State.Slider(0.0007, { min: -2/60, max: 2/60, step: 0.01/60 }),
        noiseScale: State.Slider(0.87, { min: -50, max: 50, step: 0.01 }),
        distance: {
            style: State.Select('exp',
                { options: ['min', 'pow', 'exp', 'smin'] }),
            // smooth: State.Slider(27, { min: -40, max: 40, step: 0.01 }),
            // limit: State.Slider(0.005, { min: 0, max: 2, step: 0.001 }),
            smooth: State.Slider(40, { min: -40, max: 40, step: 0.01 }),
            limit: State.Slider(0.018, { min: 0, max: 2, step: 0.001 }),

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
            smooth: State.Slider(0.05, { min: -40, max: 40, step: 0.01 }),
            size: State.Slider(0.001, { min: -10, max: 10, step: 0.001 }),
            fade: State.Slider(0.005, { min: -10, max: 10, step: 0.001 }),
            vignette: State.Slider(-4, { min: -5, max: 5, step: 0.001 }),

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
            // bias: State.Slider(8, { min: -40, max: 40, step: 0.01 }),
            bias: State.Slider(14, { min: -40, max: 40, step: 0.01 }),

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
        fillCurve: [
            State.Slider(0, { min: -3, max: 3, step: 0.01 }),
            State.Slider(0.333, { min: -3, max: 3, step: 0.01 }),
            State.Slider(0.666, { min: -3, max: 3, step: 0.01 }),
            State.Slider(1, { min: -3, max: 3, step: 0.01 })
        ],
        // blur: {
        //     radius: ,
        //     samples:
        // },
        rings: {
            length: 6,
            0: {
                x: State.Slider(0.437, { min: -2, max: 2, step: 0.001 }),
                y: State.Slider(0.244, { min: -2, max: 2, step: 0.001 }),
                radius: State.Slider(0.473, { min: 0, max: 2, step: 0.001 }),
                splits: State.Slider(9, { min: 0, max: 100, step: 1 }),
                spin: State.Slider(6, { min: 0, max: 100, step: 1 })
            },
            1: {
                x: State.Slider(0.437, { min: -2, max: 2, step: 0.001 }),
                y: State.Slider(0.244, { min: -2, max: 2, step: 0.001 }),
                radius: State.Slider(0.416, { min: 0, max: 2, step: 0.001 }),
                splits: State.Slider(9, { min: 0, max: 100, step: 1 }),
                spin: State.Slider(6, { min: 0, max: 100, step: 1 })
            },
            2: {
                x: State.Slider(-0.424, { min: -2, max: 2, step: 0.001 }),
                y: State.Slider(-0.037, { min: -2, max: 2, step: 0.001 }),
                radius: State.Slider(0.538, { min: 0, max: 2, step: 0.001 }),
                splits: State.Slider(8, { min: 0, max: 100, step: 1 }),
                spin: State.Slider(8, { min: 0, max: 100, step: 1 })
            },
            3: {
                x: State.Slider(-0.424, { min: -2, max: 2, step: 0.001 }),
                y: State.Slider(-0.037, { min: -2, max: 2, step: 0.001 }),
                radius: State.Slider(0.478, { min: 0, max: 2, step: 0.001 }),
                splits: State.Slider(8, { min: 0, max: 100, step: 1 }),
                spin: State.Slider(8, { min: 0, max: 100, step: 1 })
            },
            4: {
                x: State.Slider(0.097, { min: -2, max: 2, step: 0.001 }),
                y: State.Slider(-0.195, { min: -2, max: 2, step: 0.001 }),
                radius: State.Slider(0.556, { min: 0, max: 2, step: 0.001 }),
                splits: State.Slider(0, { min: 0, max: 100, step: 1 }),
                spin: State.Slider(-3, { min: 0, max: 100, step: 1 })
            },
            5: {
                x: State.Slider(0.097, { min: -2, max: 2, step: 0.001 }),
                y: State.Slider(-0.195, { min: -2, max: 2, step: 0.001 }),
                radius: State.Slider(0.502, { min: 0, max: 2, step: 0.001 }),
                splits: State.Slider(0, { min: 0, max: 100, step: 1 }),
                spin: State.Slider(-3, { min: 0, max: 100, step: 1 })
            }

            // length: 3,
            // 0: {
            //     x: State.Slider(0.437, { min: -2, max: 2, step: 0.001 }),
            //     y: State.Slider(0.244, { min: -2, max: 2, step: 0.001 }),
            //     radius: State.Slider(0.473, { min: 0, max: 2, step: 0.001 }),
            //     splits: State.Slider(9*2, { min: 0, max: 100, step: 1 }),
            //     spin: State.Slider(6, { min: 0, max: 100, step: 1 })
            // },
            // 1: {
            //     x: State.Slider(-0.424, { min: -2, max: 2, step: 0.001 }),
            //     y: State.Slider(-0.037, { min: -2, max: 2, step: 0.001 }),
            //     radius: State.Slider(0.538, { min: 0, max: 2, step: 0.001 }),
            //     splits: State.Slider(8*2, { min: 0, max: 100, step: 1 }),
            //     spin: State.Slider(8, { min: 0, max: 100, step: 1 })
            // },
            // 2: {
            //     x: State.Slider(0.097, { min: -2, max: 2, step: 0.001 }),
            //     y: State.Slider(-0.195, { min: -2, max: 2, step: 0.001 }),
            //     radius: State.Slider(0.556, { min: 0, max: 2, step: 0.001 }),
            //     splits: State.Slider(0*2, { min: 0, max: 100, step: 1 }),
            //     spin: State.Slider(-3, { min: 0, max: 100, step: 1 })
            // }
        },
        draw: {
            premultiplyAlpha: false,
            test: false,
            red: State.Slider(1, { min: 0, max: 1, step: 0.01 }),
            green: State.Slider(1, { min: 0, max: 1, step: 0.01 }),
            blue: State.Slider(1, { min: 0, max: 1, step: 0.01 }),
            alpha: State.Slider(1, { min: 0, max: 1, step: 0.01 })
        }
    });

    const cache = {
        props: {},
        viewShape: [],
        maskShape: [],
        edgeFade: [],
        fillCurve: [],
        rings: [],
        ringSpins: [],
        levels: []
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
        imageScale: regl.prop('state.imageScale'),
        maskStrength: regl.prop('state.maskStrength'),
        speed: regl.prop('state.speed'),
        noiseScale: regl.prop('state.noiseScale'),
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
        fillCurve: (c, { state: { fillCurve } }) => {
            const { fillCurve: f } = cache;

            f[0] = fillCurve[0];
            f[1] = fillCurve[1];
            f[2] = fillCurve[2];
            f[3] = fillCurve[3];

            return f;
        },
        levels: (c, { state: { draw: { red: r, green: g, blue: b, alpha: a } } }) => {
            const { levels } = cache;

            levels[0] = r;
            levels[1] = g;
            levels[2] = b;
            levels[3] = a;

            return levels;
        },
        mask: regl.prop('mask'),
        maskShape: (c, { mask: { width: w, height: h } }) => {
            const { maskShape } = cache;

            maskShape[0] = w;
            maskShape[1] = h;

            return maskShape;
        }
    };

    each((v, i) => {
            uniforms[`images[${i}]`] = regl.prop(`images[${i}]`);
            uniforms[`shapes[${i}]`] = regl.prop(`shapes[${i}]`);
        },
        range(maxImages));

    each((v, i) => {
            uniforms[`rings[${i}]`] = (c, { state: { rings } }) => {
                const { rings: r } = cache;
                const ring = rings[i];
                const v = (r[i] || (r[i] = []));

                r.length = rings.length;
                v[0] = ring.x;
                v[1] = ring.y;
                v[2] = ring.radius;
                v[3] = ring.splits;

                return v;
            };

            uniforms[`ringSpins[${i}]`] = (c, { state: { rings } }) => {
                const { ringSpins: r } = cache;

                r.length = rings.length;

                return r[i] = rings[i].spin;
            };
        },
        state.value.rings);

    const updateFrag = ({
            frag,
            state: {
                imageCount: i,
                cellCount: c,
                distance: { style: d },
                edge: { style: b },
                space: { style: s },
                draw: { test: t, premultiplyAlpha: a },
                rings: r,
                rs = reduce((c, v) => c+v.splits, r, 0)
            }
        }) =>
        `#define imageCount ${i}\n`+
        `#define cellCount ${c+rs}\n`+
        `#define ringCount ${r.length}\n`+
        `#define ringSplitsCount ${rs}\n`+
        `#define distStyle distStyle_${d}\n`+
        `#define edgeStyle edgeStyle_${b}\n`+
        `#define spaceStyle spaceStyle_${s}\n`+
        ((t)? `#define drawTest\n` : '')+
        ((a)? `#define premultiplyAlpha\n` : '')+
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
