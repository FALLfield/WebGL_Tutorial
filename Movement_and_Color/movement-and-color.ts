//Demo configuration constant
const SPAWN_RATE = 0.08;
const MIN_SHAPE_TIME = 0.25;
const MAX_SHAPE_TIME = 6;
const MIN_SHAPE_SPEED = 125;
const MAX_SHAPE_SPEED = 350;
const MIN_SHAPE_SIZE = 2;
const MAX_SHAPE_SIZE = 50;
const MAX_SHAPE_COUNT = 250;
const SPWANER_CHANGE_TIME = 3;

//Display an error message to the DOM, beneath the demo element
function showError(erroText: string) {
    console.error(erroText);
    const errorBoxDiv = document.getElementById('error-box');
    if (errorBoxDiv === null) {
        return;
    }
    const errorElement = document.createElement('p');
    errorElement.innerText = erroText;
    errorBoxDiv.appendChild(errorElement);
}

showError('This is what an error looks like!');

const vertexShaderSourceCode = `#version 300 es
    precision mediump float;
    
    in vec2 vertexPosition;
    in vec3 vertexColor;

    out vec3 fragmentColor;

    uniform vec2 canvasSize;
    uniform vec2 shapeLocation;
    uniform float shapeSize;

    void main(){
        fragmentColor = vertexColor;
        vec2 finalVertexPosition = vertexPosition * shapeSize + shapeLocation;
        vec2 clipPosition = (finalVertexPosition / canvasSize) * 2.0 - 1.0;
        gl_Position = vec4(clipPosition, 0.0, 1.0);
    } `;
const fragmentShaderSourceCode = `#version 300 es
    precision mediump float;

    in vec3 fragmentColor;
    out vec4 outputColor;
    
    void main(){
        outputColor = vec4(fragmentColor, 1.0);
    }`;

const trianglePositions = new Float32Array([0.0, 1.0, -1.0, -1.0, 1.0, -1.0,]);
const squarePositions = new Float32Array([-1, 1, -1, -1, 1, -1, -1, 1, 1, -1, 1, 1]);
const rgbTriangleColors = new Uint8Array([
    255, 0, 0,
    0, 255, 0,
    0, 0, 255,
]);
const fireyTriangleColors = new Uint8Array([
    229, 47, 15,
    246, 206, 29,
    233, 154, 26,
])
const indigoGradientSquareColors = new Uint8Array([
    167, 153, 255,
    88, 62, 122,
    88, 62, 122,
    167, 153, 255,
    88, 62, 122,
    167, 153, 255,
])
const graySquareColors = new Uint8Array([
    45, 45, 45,
    45, 45, 45,
    45, 45, 45,
    45, 45, 45,
    45, 45, 45,
    45, 45, 45,
])

function createStaticVertexBuffer(gl: WebGL2RenderingContext, data: ArrayBuffer) {
    const buffer = gl.createBuffer();
    if (!buffer) {
        showError('Failed to allocate buffer');
        return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return buffer;
}

function createTwoBufferVAO(gl: WebGL2RenderingContext, positionBuffer: WebGLBuffer, colorBuffer: WebGLBuffer, positionAttribLocation: number, colorAttribLocation: number) {
    const vao = gl.createVertexArray();
    if (!vao) {
        showError('Failed to allocate VAO for 2 buffers');
        return null;
    }

    gl.bindVertexArray(vao);

    gl.enableVertexAttribArray(positionAttribLocation);
    gl.enableVertexAttribArray(colorAttribLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(colorAttribLocation, 3, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    return vao;

}

function getRandomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

class MovingShapde {
    constructor(
        public position: [number, number],
        public velocity: [number, number],
        public size: number,
        public timeRemaining: number,
        public vao: WebGLVertexArrayObject,
        public numVertices: number,
    ) { }

    isAlive() {
        return this.timeRemaining > 0;
    }

    update(dt: number) {
        this.position[0] += this.velocity[0] * dt;
        this.position[1] += this.velocity[1] * dt;

        this.timeRemaining -= dt;
    }
}

function movementAndColor() {
    /** @type{HTMLCanvasElement|null}*/
    const canvas = document.getElementById('demo-canvas');
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        showError("Cannot get demo-canvas reference - check for types or loading script too early in HTML");
        return;
    }
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        const isWebGl1Supported = !!canvas.getContext('webgl');
        if (isWebGl1Supported) {
            showError("This browser support WebGL1 but not WebGL2 - make sure WebGL2 isn't disabled in your browser");
        } else {
            showError("This browser does not support WebGL2 - this demo won't work");
        }
        return;
    }

    const triangleGeoBuffer = createStaticVertexBuffer(gl, trianglePositions);
    const fireyTriangleColorsBuffer = createStaticVertexBuffer(gl, fireyTriangleColors);
    const rgbTriangleColorsBuffer = createStaticVertexBuffer(gl, rgbTriangleColors);

    const squareGeoBuffer = createStaticVertexBuffer(gl, squarePositions);
    const indigoGradientSquareColorBuffer = createStaticVertexBuffer(gl, indigoGradientSquareColors);
    const graySquareColorsBuffer = createStaticVertexBuffer(gl, graySquareColors);

    if (!triangleGeoBuffer || !rgbTriangleColorsBuffer || !fireyTriangleColorsBuffer || !squareGeoBuffer || !indigoGradientSquareColorBuffer || !graySquareColorsBuffer) {
        showError(`Failed to create 2 vertex buffers (triangle pos = ${!!triangleGeoBuffer},`
            + ` ,rgb tri color = ${!!rgbTriangleColorsBuffer}`
            + ` ,firey tri color = ${!!fireyTriangleColorsBuffer}`
            + ` ,square pos = ${!!squareGeoBuffer}`
            + ` ,indigo color = ${!!indigoGradientSquareColorBuffer}`
            + ` ,gray s color = ${!!graySquareColorsBuffer})`
        );
        return null;
    }



    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (vertexShader === null) {
        showError("Could not allocate vertex shader");
        return;
    }
    gl.shaderSource(vertexShader, vertexShaderSourceCode);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        const compileError = gl.getShaderInfoLog(vertexShader);
        showError(`Failed to COMPILE vertex shader - ${compileError}`);
        return;
    }



    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (fragmentShader === null) {
        showError('Could not allocate fragment shader');
        return;
    }
    gl.shaderSource(fragmentShader, fragmentShaderSourceCode);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        const compileError = gl.getShaderInfoLog(fragmentShader);
        showError(`Failed to COMPILE fragment shader - ${compileError}`);
        return;
    }

    const triangleShaderProgram = gl.createProgram();
    if (triangleShaderProgram === null) {
        showError('Could not allocate triangle shader program');
        return;
    }
    gl.attachShader(triangleShaderProgram, vertexShader);
    gl.attachShader(triangleShaderProgram, fragmentShader);
    gl.linkProgram(triangleShaderProgram);
    if (!gl.getProgramParameter(triangleShaderProgram, gl.LINK_STATUS)) {
        const linkError = gl.getProgramInfoLog(triangleShaderProgram);
        showError(`Falied to LINK shaders - ${linkError}`);
        return;
    }

    const vertexPositionAttribLocation = gl.getAttribLocation(triangleShaderProgram, 'vertexPosition');
    const vertexColorAttribLocation = gl.getAttribLocation(triangleShaderProgram, 'vertexColor');
    if (vertexPositionAttribLocation < 0 || vertexColorAttribLocation < 0) {
        showError(`Failed to get attrib locations: (pos=${vertexPositionAttribLocation},` + ` color = ${vertexColorAttribLocation})`);
        return;
    }

    const shapeLocationUniform = gl.getUniformLocation(triangleShaderProgram, 'shapeLocation');
    const shapeSizeUniform = gl.getUniformLocation(triangleShaderProgram, 'shapeSize');
    const canvasSizeUniform = gl.getUniformLocation(triangleShaderProgram, 'canvasSize');
    if (shapeLocationUniform === null || shapeSizeUniform === null || canvasSizeUniform === null) {
        showError(`Failed to get uniform locations (shapeLocation = ${!!shapeLocationUniform}` + `, shapeSize = ${!!shapeSizeUniform}` + `canvasSize=${canvasSizeUniform}`);
        return;
    }

    //Create VAO
    const rgbTriangleVao = createTwoBufferVAO(gl, triangleGeoBuffer, rgbTriangleColorsBuffer, vertexPositionAttribLocation, vertexColorAttribLocation);
    const fieryTriangleVao = createTwoBufferVAO(gl, triangleGeoBuffer, fireyTriangleColorsBuffer, vertexPositionAttribLocation, vertexColorAttribLocation);
    const indigoSquareVao = createTwoBufferVAO(gl, squareGeoBuffer, indigoGradientSquareColorBuffer, vertexPositionAttribLocation, vertexColorAttribLocation);
    const graySquareVao = createTwoBufferVAO(gl, squareGeoBuffer, graySquareColorsBuffer, vertexPositionAttribLocation, vertexColorAttribLocation);
    if (!rgbTriangleVao || !fieryTriangleVao || !indigoSquareVao || !graySquareVao) {
        showError(`Failed to create VAOs: (` + `rgb Triangle = ${!!rgbTriangleVao}`
            + ` ,fiery Triangle = ${fieryTriangleVao}`
            + ` ,indigo square = ${indigoSquareVao}`
            + ` , gray square = ${graySquareVao})`);
        return;
    }

    const geometryList = [
        { vao: rgbTriangleVao, numVertices: 3 },
        { vao: fieryTriangleVao, numVertices: 3 },
        { vao: indigoSquareVao, numVertices: 6 },
        { vao: graySquareVao, numVertices: 6 },
    ];



    let shapes: MovingShapde[] = [

    ];
    let timeToNextSpawn = SPAWN_RATE;
    let spawnPosition = [
        getRandomInRange(canvas.width * 0.1, canvas.width * 0.9),
        getRandomInRange(canvas.height * 0.1, canvas.height * 0.9),
    ];
    let timeToSpawnerChange = SPWANER_CHANGE_TIME;

    let lastFrameTime = performance.now();
    const frame = function () {
        const thisFrameTime = performance.now();
        const dt = (thisFrameTime - lastFrameTime) / 1000;
        lastFrameTime = thisFrameTime;

        //Update spawner
        timeToSpawnerChange -= dt;
        if (timeToSpawnerChange < 0) {
            timeToSpawnerChange = SPWANER_CHANGE_TIME;
            spawnPosition = [
                getRandomInRange(canvas.width * 0.1, canvas.width * 0.9),
                getRandomInRange(canvas.height * 0.1, canvas.height * 0.9),
            ];
        }

        //Update shapes
        timeToNextSpawn -= dt;
        while (timeToNextSpawn < 0) {
            timeToNextSpawn += SPAWN_RATE;

            const movementAngle = getRandomInRange(0, 2 * Math.PI);
            const movementSpeed = getRandomInRange(MIN_SHAPE_SPEED, MAX_SHAPE_SPEED);

            const position: [number, number] = [spawnPosition[0], spawnPosition[1]];
            const velocity: [number, number] = [
                Math.sin(movementAngle) * movementSpeed,
                Math.cos(movementAngle) * movementSpeed,
            ];
            const size = getRandomInRange(MIN_SHAPE_SIZE, MAX_SHAPE_SIZE);
            const timeRemaining = getRandomInRange(MIN_SHAPE_TIME, MAX_SHAPE_TIME);

            const geometryIndx = Math.floor(getRandomInRange(0, geometryList.length));
            const geometry = geometryList[geometryIndx];

            const shape = new MovingShapde(position, velocity, size, timeRemaining, geometry.vao, geometry.numVertices);

            shapes.push(shape);
        }

        for (let i = 0; i < shapes.length; i++) {
            shapes[i].update(dt);
        }
        shapes = shapes.filter((shape) => shape.isAlive()).slice(0, MAX_SHAPE_COUNT);

        //Output merger - how to merge the shaded pixel fragment with the existing output image
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.clearColor(0.08, 0.08, 0.08, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        //Rasterizer - which pixels are part of a triangle
        gl.viewport(0, 0, canvas.width, canvas.height);

        //Vertex shader - how to place those vertices in clip space
        //Fragment shader - what color a pixel should be 
        gl.useProgram(triangleShaderProgram);

        gl.uniform2f(canvasSizeUniform, canvas.width, canvas.height);

        for (let i = 0; i < shapes.length; i++) {
            //Draw call (also configures primitive assembly)
            //First triangle
            gl.uniform1f(shapeSizeUniform, shapes[i].size);
            gl.uniform2f(shapeLocationUniform, shapes[i].position[0], shapes[i].position[1]);
            gl.bindVertexArray(shapes[i].vao);
            gl.drawArrays(gl.TRIANGLES, 0, shapes[i].numVertices);
        }
        requestAnimationFrame(frame);

    };
    requestAnimationFrame(frame);


}

try {
    movementAndColor()
} catch (e) {
    showError(`Uncaught JavaScript exeception: ${e}`);
}
