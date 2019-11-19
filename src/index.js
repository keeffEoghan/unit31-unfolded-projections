import getRegl from 'regl';
import State from 'controls-state';
import GUI from 'controls-gui';
import merge from 'lodash-es/merge';

import { positions as screenPositions } from './screen';
import { range, map, each } from './array';
import { rootPath } from './utils';

import screenVert from './screen/index.vert.glsl';
import drawFrag from './draw.frag.glsl';

const regl = self.regl = getRegl({
    attributes: { antialias: false, depth: false },
    pixelRatio: Math.max(+devicePixelRatio, 1.5)
});

const state = State({
    draw: {
        numImages: State.Slider(16,
            { min: 1, max: regl.limits.maxTextureUnits, step: 1 }),
        numCells: State.Slider(30, { min: 0, max: 100, step: 1 }),
        speed: State.Slider(0.1/60, { min: -2/60, max: 2/60, step: 0.01/60 }),
        smoothing: {
            amount: State.Slider(2**7, { min: 0, max: 2**7, step: 1 }),
            limit: State.Slider(0.3, { min: 0, max: 2, step: 0.01 }),
            style: State.Select('none', { options: ['power', 'exponent', 'none'] }),
        }
    },
    presets: State.Section({
            simple() {
                merge(state, {});
            }
        },
        { enumerable: false, label: 'State Output' }),
    stateOutput: State.Section({
            output: State.Raw((h, { state }) =>
                h('pre', { style: 'max-width: 260px; overflow: auto;' },
                    JSON.stringify(state, null, 4, 0)))
        },
        { enumerable: false, label: 'State Output' })
});

const controls = GUI(state, {
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

const listeners = {
    active: [],
    add(el, type, f) {
        const binding = [el, type, f];

        this.active.push(binding);
        el.addEventListener(type, f);

        return binding;
    },
    remove(binding) {
        const [el, type, f] = binding;

        el.removeEventListener(type, f);
        this.active.splice(this.active.indexOf(binding), 1);
    },
    removeAll() {
        this.active.forEach(([el, type, f]) => el.removeEventListener(type, f));
        this.active.length = 0;
    }
};

if(module.hot) {
    module.hot.dispose(() => {
        console.log('hot reload - dispose');
        listeners.removeAll();
        (regl && regl.destroy());
        (controls && document.querySelector('.controls').remove());
    });

    module.hot.accept(() => console.log('hot reload - accept'));
}

const updateFrag = () =>
    `#define numImages ${state.draw.numImages}\n`+
    `#define numCells ${state.draw.numCells}\n`+
    `#define smoothing_${state.draw.smoothing.style}\n`+
    '\n'+
    drawFrag;

let frag = updateFrag();

const cache = {
    viewShape: [0, 0]
};

const uniforms = {
    tick: regl.context('tick'),
    viewShape: ({ viewportWidth: w, viewportHeight: h }) => {
        const { viewShape } = cache;

        viewShape[0] = w;
        viewShape[1] = h;

        return viewShape;
    },
    speed: regl.prop('state.draw.speed'),
    smoothing: regl.prop('state.draw.smoothing.amount'),
    smoothLimit: regl.prop('state.draw.smoothing.limit')
};

each((v, i) => {
        uniforms[`images[${i}]`] = regl.prop(`textures[${i}]`);
        uniforms[`shapes[${i}]`] = regl.prop(`shapes[${i}]`);
    },
    range(regl.limits.maxTextureUnits));

const drawState = {
    state,
    sources: [],
    images: [],
    textures: [],
    shapes: []
};

function updateImages() {
    each((t, i) => t.destroy(), drawState.textures);

    drawState.sources.length = drawState.images.length = drawState.textures.length =
        drawState.shapes.length = 0;

    drawState.sources = map((v, i) => {
            const source = `${rootPath}assets/${i}.jpg`;

            const image = drawState.images[i] = new Image();
            const texture = drawState.textures[i] = regl.texture();
            const shape = drawState.shapes[i] = [texture.width, texture.height];

            image.addEventListener('load', () => {
                texture(image);
                shape[0] = texture.width;
                shape[1] = texture.height;
            });

            return image.src = source;
        },
        range(state.draw.numImages), 0);
}

updateImages();

state.$onChanges((changes) => {
    if(('draw.numImages' in changes) || ('draw.numCells' in changes) ||
        ('draw.smoothing.style' in changes)) {
        frag = updateFrag();
    }

    if(('draw.numImages' in changes)) {
        updateImages();
    }
});

const draw = regl({
    vert: screenVert,
    frag: () => frag,
    attributes: { position: screenPositions },
    uniforms,
    count: screenPositions.length/2
});

regl.frame(() => {
    regl.clear({ color: [0, 0, 0, 255], depth: 1 });
    draw(drawState);
});
