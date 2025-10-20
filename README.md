# fur-rendering

This project implements real-time fur rendering using shell and fin rendering techniques, and adds basic wind animations with a focus on user interactivity and experimentation. The technique strikes a balance between realism and efficiency at medium-viewing distances by approximating individual strands of fur with layered planes extruded from the mesh, allowing smooth animations even in the browser.

## Live Demo
The project is live at [https://feyeh-sbu.github.io/fur-rendering/](https://feyeh-sbu.github.io/fur-rendering/). It is automatically built and deployed using [GitHub Pages](https://docs.github.com/en/pages).

## Running the code locally

1. Clone the repository:

```bash
git clone https://github.com/feyeh-sbu/fur-rendering.git
```

2. Navigate to the project directory:
```bash
cd fur-rendering
```

3. Host the file on a local development server. You can use Python's built-in HTTP server with the following command:
```bash
python -m http.server
```

4. Open http://localhost:8000 in your browser and you should see the application running.

## Using the application

The application prioritizes interactivity through the parameter panel on the right. There you can adjust a wide range of parameters and observe their effects on the rendered output. The parameters are organized logically according to the different parts of this project:

1. **Shell Rendering**: control various parameters related to the rendering of the shells, including shell spacing, shell tapering, alpha falloff, and more.

1. **Fin Rendering**: control various parameters related to the rendering of the fins, including fin count, find length, silhouette sensitivity, and more.

1. **Wind Simulation**: control various parameters related to the animation of wind effects, including global wind direction, turbulence, wind gusts, and more.

There are also presets for fur length and wind that are a good starting point for further adjustment of parameters.