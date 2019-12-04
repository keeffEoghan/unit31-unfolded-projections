import State from 'controls-state';
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
            limit: State.Slider(0.2, { min: 0, max: 2, step: 0.01 }),
            smoothing: {
                amount: State.Slider(7, { min: 0, max: 2**7, step: 1 }),
                style: State.Select('exponent',
                    { options: ['none', 'power', 'exponent'] })
            },
            border: {
                size: State.Slider(0.01, { min: 0, max: 1, step: 0.0001 }),
                style: State.Select('pass2Skip',
                    { options: ['none', 'pass2Skip', 'pass2'] })
            },
            space: {
                nearBias: State.Slider(1, { min: -10, max: 10, step: 0.0001 }),
                style: State.Select('nearby', { options: ['none', 'nearby'] })
            }
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
        smoothing: regl.prop('state.distance.smoothing.amount'),
        borderSize: regl.prop('state.distance.border.size'),
        nearBias: regl.prop('state.distance.space.nearBias')
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
                distance: {
                    smoothing: { style: s },
                    border: { style: b },
                    space: { style: n }
                }
            }
        }) =>
        `#define imageCount ${i}\n`+
        `#define cellCount ${c}\n`+
        `#define smoothingStyle smoothingStyle_${s}\n`+
        `#define borderStyle borderStyle_${b}\n`+
        `#define spaceStyle spaceStyle_${n}\n`+
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
