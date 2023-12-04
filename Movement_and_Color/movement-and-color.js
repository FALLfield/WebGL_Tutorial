"use strict";
//Display an error message to the DOM, beneath the demo element
function showError(erroText) {
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
const trianglePositions = new Float32Array([0.0, 1.0, -1.0, -1.0, 1.0, -1.0,]);
const rgbTriangleColors = new Uint8Array([
    255, 0, 0,
    0, 255, 0,
    0, 0, 255,
]);
const fireyTriangleColors = new Uint8Array([
    229, 47, 15,
    246, 206, 29,
    233, 154, 26,
]);
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
        }
        else {
            showError("This browser does not support WebGL2 - this demo won't work");
        }
        return;
    }
    const triangleGeoBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleGeoBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, trianglePositions, gl.STATIC_DRAW);
    const fireyTriangleColorsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fireyTriangleColorsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, fireyTriangleColors, gl.STATIC_DRAW);
    const rgbTriangleColorsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, rgbTriangleColorsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, rgbTriangleColors, gl.STATIC_DRAW);
    const vertexShaderSourceCode = `#version 300 es
    precision mediump float;
    
    in vec2 vertexPosition;

    uniform vec2 canvasSize;
    uniform vec2 shapeLocation;
    uniform float shapeSize;

    void main(){
        vec2 finalVertexPosition = vertexPosition * shapeSize + shapeLocation;
        vec2 clipPosition = (finalVertexPosition / canvasSize) * 2.0 - 1.0;
        gl_Position = vec4(clipPosition, 0.0, 1.0);
    } `;
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
    const fragmentShaderSourceCode = `#version 300 es
    precision mediump float;
    out vec4 outputColor;
    
    void main(){
        outputColor = vec4(0.298, 0.0, 0.51, 1.0);
    }`;
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
    if (vertexPositionAttribLocation < 0) {
        showError('Failed to get attrib location for vertexPosition');
        return;
    }
    const shapeLocationUniform = gl.getUniformLocation(triangleShaderProgram, 'shapeLocation');
    const shapeSizeUniform = gl.getUniformLocation(triangleShaderProgram, 'shapeSize');
    const canvasSizeUniform = gl.getUniformLocation(triangleShaderProgram, 'canvasSize');
    if (shapeLocationUniform === null || shapeSizeUniform === null || canvasSizeUniform === null) {
        showError(`Failed to get uniform locations (shapeLocation = ${!!shapeLocationUniform}` + `, shapeSize = ${!!shapeSizeUniform}` + `canvasSize=${canvasSizeUniform}`);
        return;
    }
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
    gl.enableVertexAttribArray(vertexPositionAttribLocation);
    //Input assembler - how to read vertices from our GPU triangle buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleGeoBuffer);
    gl.vertexAttribPointer(
    //index: which attribute to use
    vertexPositionAttribLocation, 
    //size:how many components in that attribute
    2, 
    //type:what is the data type stored in the GPU buffer for this attribute?
    gl.FLOAT, 
    //normallized: determines how to convert ints to floats, if that's what you're doing
    false, 
    //stride: how many bytes to move forward in the buffer to find the smae attribute for the next vertex
    2 * Float32Array.BYTES_PER_ELEMENT, 
    //offset: how many bytes should the input assembler skip into the buffer when readin attributes
    0);
    gl.uniform2f(canvasSizeUniform, canvas.width, canvas.height);
    //Draw call (also configures primitive assembly)
    gl.uniform1f(shapeSizeUniform, 200);
    gl.uniform2f(shapeLocationUniform, 300, 400);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.uniform1f(shapeSizeUniform, 100);
    gl.uniform2f(shapeLocationUniform, 650, 300);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
}
try {
    movementAndColor();
}
catch (e) {
    showError(`Uncaught JavaScript exeception: ${e}`);
}
