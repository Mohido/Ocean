# Ocean-JS
Simulating The Ocean with Three.js and JavaScript. This project is an implementation of the first chapter of the GPU Gems book, focusing on effective water simulation.

## Try It Out
You can try out the project [here](https://mohido.github.io/ocean).

## Structure

* **index.html**: Contains the basic HTML structure.
* **main.js**: Contains the logic of the animation. Be careful, the code is very unorganized. Things to keep in mind:
  - **main()**: Application entry point function.
  - **First Pass**: Initializes the first pass (renders wave positions and normals into two textures).
  - **Second Pass**: Initializes the second pass (final render. Uses the textures from the first pass to draw the scene). Option `Main` in the UI corresponds to this pass.
  - **Third Pass**: The third pass handles visualization of the normal and position maps. `Normal` and `Position` options in the UI correspond to this pass.

* **shaders.js**: Contains the necessary shader codes for the three passes.

## Preview
### Final Scene
![image](https://github.com/user-attachments/assets/06665dce-a4e0-4f6e-9180-387f1f90d604)

### UI
![image](https://github.com/user-attachments/assets/ce733b90-642c-423c-9982-9dcfd55538f6)

### Normal Map Viewer
![image](https://github.com/user-attachments/assets/410e6aab-e398-4e08-b1a0-5b055989c6ab)

### Position Map Viewer
![image](https://github.com/user-attachments/assets/0a125bbf-25b3-4394-8c38-fe92159c8cd5)



## Credits
This project was made possible with the following resources:

- **GPU Gems Chapter 1**: [Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)
- **PolyHaven**: [Syferfontein 1d Clear (Pure Sky)](https://polyhaven.com/a/syferfontein_1d_clear_puresky)
- **Three.js Documentation**: [Three.js](https://threejs.org/docs/)
- **WebGL Shaders and GLSL**: [WebGL Fundamentals](https://webglfundamentals.org/)
