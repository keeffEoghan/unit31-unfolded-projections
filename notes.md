# Unit31 Unfolded Projections

## To-do

- Texture sprite map.
  - maxTextureSize: 16384
  - maxTextureUnits: 16
- Cycle textures images (fade out, swap, fade in).
- Rotate texture lookups according to axis from fragment to point.
- Set up mask for the tendrils stuff too.
- Optical flow interaction:
  - Set up optical flow pass and buffer.
  - Separate points creation/movement into its own render pass and buffer, looking up optical flow.
  - Read points from the main voronoi shader.

## References

- [`glsl-voronoi-noise`](https://github.com/MaxBittker/glsl-voronoi-noise)
- [Unicorn Puke](https://thebookofshaders.com/edit.php?log=160504143842) (see [Book of Shaders: Cellular Noise](https://thebookofshaders.com/12/))

## Tech

- Voronoi SDF
  - [IQ's cell voronoi](https://www.shadertoy.com/view/ldl3W8) and [an imrovement](https://www.shadertoy.com/view/llG3zy).
    - Undertsand that the first pass finds the nearest cell, and the second pass finds the second-nearest and does the border-distance calculation... _it doesn't find he nearest cell's nearest cell!_ So, we need the cells and
    - I think this could be sped up just keeping track of the nearest 2 cells to the fragment, instead of the nearest cell, and could be done in one pass.
- Use texture sprites to get all the images in:
  - https://github.com/mattdesl/gl-sprite-batch
  - https://www.npmjs.com/package/atlaspack
  - https://github.com/soimy/maxrects-packer
  - https://github.com/odrick/free-tex-packer-core
- Path points mapped along edges of discs:
  - Trace points along discs circumferences (perspective-projected ring?):
    - 2 points near each other but not touching (concentric slightly different radii) should produce a tangential line between them in most cases of the voronoi later.
    - Animate the points along.
  - Mask/stencil overall output along same ring paths.
- Draw different images based on area of cell:
  - First thoughts for pixel area/histogram using gather algorithm:
    - Need to split into 3 passes:
      - Pass 1: do vornoi and outputs each cell's colour as the index of the cell (packed into RGBA).
      - Pass 2: get the area of each cell as the number of pixels for each image index as produced by pass 1:
        - Use WebGL and a mip-map-like pass to estimate area at increasing scales?
        - Use WebGL and a big loop over all pixels for each image index? (Probably low parallelism.)
        - Use JavaScript and sum the cell values into each image's area counter in one loop?
      - Pass 3: blit an effect into each cell based on various thresholds of the cell areas for each image.
  - Histogram for exact area:
    - Turns out efficient generation of histograms on the GPU is an active area of research...
      - [AMD paper using vertex shader for scatter algorithm](https://developer.amd.com/wordpress/media/2012/10/GPUHistogramGeneration_preprint.pdf)
    - Logic for full process (_italics denote an old assumption/misunderstanding_):
      - Render points points buffer:
        - Flowy/noisy points, optical flow (movement, creation).
        - Path points.
      - _Render points derived buffer by scatter for each point (On^2, [n, 1], for n = points):_
        - The nearest neighbouring point distance.
        - The nearest neighbouring point index.
      - Render voronoi buffer, using points buffer _and points derived buffer_:
        - VoronoiSDF, using points buffer _and derived nearest neighbouring point distance (if this doesn't work in all directions, just use the index instead)_ to get the border.
      - Render area histogram buffer (On for n = screen area, [n, 1] for n = points), using.
      - Render final images/colours/points/etc, using voronoi buffer and area buffer.
  - Approximate heuristic based on distances to nearest N-cells:
    - During voronoi step, instead of tracking the nearest cell, track the nearest N cells (probably a maximum of `mat4` due to GLSL ES 1.0 limitations on array construction).
    - Approximate the closest cell's area by checking the distances to the nearest N cells - they could all be on the same side, and the closest cell would still be large, but perhaps in most cases it would be close enough, and this heuristic might have some interesting side-effects.
    - Could be done in one step along with all image blitting and other effects.
    - Logic for full process (_italics denote an old assumption/misunderstanding_):
      - Render points points buffer:
        - Flowy/noisy points, optical flow (movement, creation).
        - Path points.
      - Render points derived buffer by scatter for each point (On^2, [n, 1], for n = points):
        - Sum/mean of distances to each neighbouring point.
        - The above via function to prioritise nearby neighbours?
        - _The nearest neighbouring point distance._
        - _The nearest neighbouring point index._
        - Might simply handle this as part of the next pass instead of separately.
      - Render voronoi SDF and final images/colours/points/etc, using points buffer and points derived buffer:
        - VoronoiSDF, using points buffer _and derived nearest neighbouring point distance (if this doesn't work in all directions, just use the index instead)_ to get the border.
        - Images/colours/points/etc based on area approximation, using the sum/mean of distances to each neighbouring point, via function to prioritise nearby neighbours.
