const { writeFileSync, createWriteStream } = require('fs');
const { resolve } = require('path');
const glob = require('glob');
const binPack = require('bin-pack');
const Spritesmith = require('spritesmith');

// const debug = true;
// const sources = glob.sync('./src/assets/test/**/*', { nodir: true });
const debug = false;
const sources = glob.sync('./src/assets/images/**/*', { nodir: true });
const maxSize = 16384*0.5;
const spritesmith = new Spritesmith();

(debug && console.log({ sources }));

const getBatch = (start, end, images, batches, data) => () => {
    const sprites = images.slice(start, end+1);

    (debug && console.log('Creating spritesheet:'),
        { 'data.length': data.length, start, end, sprites });

    const out = spritesmith.processImages(sprites, {
        exportOpts: { format: 'png' },
        // Pass custom layout function to respect the `maxSize` constraint.
        // @see https://github.com/twolfson/layout/blob/master/lib/algorithms/binary-tree.algorithm.js
        algorithm: {
            // `bin-pack` automatically sorts. Make this a noop.
            sort: (items) => items,
            placeItems(items) {
                // Pack the items (adds `x` and `y` to each item)
                binPack(items, { inPlace: true });

                // Return the packed items
                return items;
            }
        }
    });

    (debug && console.log('Spritesheet:', out));

    const url = `./src/assets/sprites.gitignore/${data.length}.png`;
    const imageWriter = createWriteStream(url);

    imageWriter.on('finish', () => {
        const next = batches.shift();

        if(next) {
            next();
        }
        else {
            const dataString = JSON.stringify(data);

            (debug && console.log(dataString));
            writeFileSync(`./src/assets/sprites.gitignore/data.json`, dataString);
        }
    });

    // Readable stream outputting image.
    out.image.pipe(imageWriter);

    data.push({
        url,
        // Object mapping filename to { x, y, width, height } of image.
        sprites: out.coordinates,
        // Object with metadata about spritesheet { width, height }.
        sheet: out.properties
    });
};

spritesmith.createImages(sources, (err, images) => {
    if(err) {
        console.error(err);

        return err;
    }

    (debug && console.log({ images }));

    let index = 0;
    const testImages = [];
    const data = [];

    const batches = images.reduce((batches, image, i) => {
            const { width: w, height: h } = image;

            // @todo These are very approximate/incorrect checks, should be in layout.
            if(w > maxSize || h > maxSize) {
                console.warn('Image size may not fit within maxmimum size',
                    { w, h, maxSize });
            }
            else {
                // See if the next packing will overflow the size constraints.
                testImages.push(image);

                const packed = binPack(testImages);
                const over = Math.max(packed.width, packed.height) > maxSize;

                if(over) {
                    batches.push(getBatch(index, i-1, images, batches, data));
                    index = i;
                    testImages.length = 0;
                    testImages.push(image);
                }

                if(i === images.length-1) {
                    batches.push(getBatch(index, i, images, batches, data));
                }
            }

            return batches;
        },
        []);

    (batches.length && batches.shift()());
});
