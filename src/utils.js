/**
 * The number of mipmap levels-of-detail an image of the given size should have.
 *
 * @see https://stackoverflow.com/a/25640078/716898
 * @see https://www.gamedev.net/forums/topic/621709-query-number-of-mipmap-levels/
 *
 * @todo +1 or -1?
 *
 * @param {number} w The width of the image.
 * @param {number} h The height of the image.
 */
export const countImageLODs = (w, h) => Math.floor(Math.log2(Math.max(w, h)))+1;
