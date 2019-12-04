import getRegl from 'regl';
import State from 'controls-state';
import GUI from 'controls-gui';
import merge from 'lodash-es/merge';
import { range, map, each } from 'array-utils';
import { getBasePath } from 'get-base-path';

import { countImageLODs } from './utils';

import {
        getVoronoi, optionalExtensions as voronoiOptionalExtensions
    } from './voronoi';

const basePath = getBasePath();

const extensions = ['OES_texture_float'];
const optionalExtensions = [...voronoiOptionalExtensions];

const regl = self.regl = getRegl({
    attributes: { antialias: false, depth: false },
    pixelRatio: Math.max((devicePixelRatio | 0), 1.5),
    extensions,
    optionalExtensions
});

const assets = { sources: [], images: [], textures: [], shapes: [] };

const voronoi = getVoronoi(regl, {
    images: assets.textures,
    shapes: assets.shapes,
    maxImages: regl.limits.maxTextureUnits
});

const state = State({
    voronoi: voronoi.state,
    presets: State.Section({
            simple: () => merge(state, {})
        },
        { enumerable: false, label: 'Presets' }),

    stateOutput: State.Section({
            output: State.Raw((h, { state }) =>
                h('pre', { style: 'max-width: 260px; overflow: auto;' },
                    JSON.stringify(state, null, 4, 0)))
        },
        { enumerable: false, label: 'State Output' })
});

GUI(state, {
    className: 'controls',
    containerCSS: `
        position: fixed;
        top: 0;
        right: 5px;
        max-width: 300px;
        max-height: 100vh;
        overflow: auto;
    `
});

// @todo Switch images when active cells leave viewport, or simply fade between.
function updateImages() {
    each((t, i) => t.destroy(), assets.textures);

    assets.sources.length = assets.images.length = assets.textures.length =
        assets.shapes.length = 0;

    map((v, i) => {
            const source = `${basePath}assets/${i}.jpg`;

            const image = assets.images[i] = new Image();
            const texture = assets.textures[i] = regl.texture();
            const shape = assets.shapes[i] = Array(3).fill(1);

            image.addEventListener('load', () => {
                // texture({ data: image, min: 'mipmap', mipmap: 'nice' });
                texture(image);

                shape[2] = countImageLODs((shape[0] = texture.width),
                    (shape[1] = texture.height));
            });

            return image.src = source;
        },
        range(state.voronoi.imageCount),
        assets.sources);
}

updateImages();

voronoi.framebuffer = regl.framebuffer({ colorType: 'float' });

const cache = {
    voronoi: { state: null }
};

function drawVoronoi() {
    cache.voronoi.state = state.voronoi;
    voronoi.draw(cache.voronoi);
}

const clear = {
    view: { color: [0, 0, 0, 1], depth: 1 },
    voronoi: { color: [0, 0, 0, 1], depth: 1, framebuffer: voronoi.framebuffer }
};

regl.frame(({ drawingBufferWidth: w, drawingBufferHeight: h }) => {
    regl.clear(clear.view);
    // regl.clear(clear.voronoi);

    // voronoi.framebuffer.resize(w, h);
    // voronoi.framebuffer.use(drawVoronoi);
    drawVoronoi();
});
