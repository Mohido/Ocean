# Ocean-JS
Simulating The Ocean with Threejs and javascript. This is a GPU Gem paper implementation



# Structure

* **index.html** Contains literally nothing..
* **main.js** Contains the logic of the animation. Be careful, the code is very unorganized. Things to keep in mind
    - *main()* : Application entry point function.
    - *First Pass* : Initializes the first pass (renders wave positions and normals into 2 textures)
    - *Second Pass* : Initializes the second pass (final render. Uses the textures from first pass to draw the scenen). Option `Main` in the UI corresponds to this pass.
    - *Third Pass* : The 3rd pass handles visualization of the normal and position maps. `Normal` and `Position` options in the UI corresponds to this pass.
    
* **shaders.js** Contains the necessary shader codes for the 3 passes.
