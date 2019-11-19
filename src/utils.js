// Handle paths on different hosts - for local/Github/etc hosting.
// @todo Coupled to the hosting setup - remove where not relevant.
export const rootPath =
    `/${((location.href.match(/:\/\/.+?\/([^\/\?]+?(?=[\/\?]|$))?/i) || [])[1] || '')}/`
        .replace(/(?:\/|.+\.html?)+/gi, '/');
