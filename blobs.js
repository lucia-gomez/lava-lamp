// based on https://codepen.io/TC5550/pen/WNNWoaO

const canvas = document.getElementById("blob-canvas");
var width = canvas.width = window.innerWidth * 0.95;
var height = canvas.height = window.innerHeight * 0.95;
const gl = canvas.getContext('webgl');

var blobs;
var minBlobSize = 10;
var maxBlobSize = 80;
var blobSpeed = 2;
var blobStickiness = 1.0;
var blobsHandle, color1Handle, color2Handle;
var color1 = hexToRGBPercentage(document.getElementById('color1').value);
var color2 = hexToRGBPercentage(document.getElementById('color2').value);
var bgColor = hexToRGBPercentage(document.documentElement.style.getPropertyValue('--bg'));

const numBlobsSlider = document.getElementById('num-blobs');
numBlobsSlider.addEventListener('input', evt => {
  blobs = getBlobs(Number(evt.target.value));
  startAnimation();
});

const minBlobSizeSlider = document.getElementById('min-blob-size');
minBlobSizeSlider.addEventListener('input', evt => {
  minBlobSize = Number(evt.target.value);
  blobs.forEach(blob => {
    blob.r = getBlobRadius();
  });
});

const maxBlobSizeSlider = document.getElementById('max-blob-size');
maxBlobSizeSlider.addEventListener('input', evt => {
  maxBlobSize = Number(evt.target.value);
  blobs.forEach(blob => {
    blob.r = getBlobRadius();
  });
});

const blobSpeedSlider = document.getElementById('blob-speed');
blobSpeedSlider.addEventListener('input', evt => {
  const oldBlobSpeed = blobSpeed;
  blobSpeed = Number(evt.target.value);
  blobs.forEach(blob => {
    blob.vx = blob.vx * blobSpeed / oldBlobSpeed;
    blob.vy = blob.vy * blobSpeed / oldBlobSpeed;
  });
});

const blobStickinessSlider = document.getElementById('blob-stickiness');
blobStickinessSlider.addEventListener('input', evt => {
  blobStickiness = Number(evt.target.value);
  startAnimation();
});

const color1Picker = document.getElementById('color1');
color1Picker.addEventListener('input', evt => {
  color1 = hexToRGBPercentage(evt.target.value);
});

const color2Picker = document.getElementById('color2');
color2Picker.addEventListener('input', evt => {
  color2 = hexToRGBPercentage(evt.target.value);
});

const bgColorPicker = document.getElementById('bg-color');
bgColorPicker.addEventListener('input', evt => {
  bgColor = hexToRGBPercentage(evt.target.value);
});

function hexToRGBPercentage(h) {
  let r = 0, g = 0, b = 0;
  r = "0x" + h[1] + h[2];
  g = "0x" + h[3] + h[4];
  b = "0x" + h[5] + h[6];
  return [r / 255.0, g / 255.0, b / 255.0];
}

function startAnimation() {
  webglSetup();

  if (window.frameId != null) {
    window.cancelAnimationFrame(window.frameId);
  }
  loop();
}

function getBlobs(numBlobs) {
  // if we have no blobs yet, generate new ones
  if (blobs == null) {
    return Array.from(Array(numBlobs)).map(getBlob);
  }

  // if we need more blobs, append new ones to the end
  if (numBlobs >= blobs.length) {
    const newBlobs = Array.from(Array(numBlobs - blobs.length)).map(getBlob);
    return blobs.concat(newBlobs);
  }

  // if we need fewer blobs, remove from the end
  return blobs.slice(0, numBlobs);
}

function getBlobRadius() {
  const range = maxBlobSize - minBlobSize;
  return Math.random() * range + minBlobSize;
}

function getBlob() {
  let vx, vy;
  do {
    vx = (Math.random() - 0.5) * blobSpeed;
    vy = (Math.random() - 0.5) * blobSpeed;
  } while (vx < 0.05 && vy < 0.05);
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: vx,
    vy: vy,
    r: getBlobRadius(),
  }
}

function moveBlob(blob) {
  blob.x += blob.vx;
  blob.y += blob.vy;

  // stay in bounds, add some noise
  if (blob.x < blob.r) { // left side
    blob.vx *= -1;
    blob.x += Math.random() * 10;
  }
  if (blob.x > width - blob.r) { // right side
    blob.vx *= -1;
    blob.x -= Math.random() * 10;
  }
  if (blob.y < blob.r || blob.y > height - blob.r) blob.vy *= -1;
}

function loop() {
  blobs.forEach(moveBlob);

  const blobData = blobs.map(blob => {
    return [blob.x, blob.y, blob.r];
  });
  const blobDataFlat = new Float32Array([].concat.apply([], blobData));

  gl.uniform3fv(blobsHandle, blobDataFlat);
  gl.uniform3fv(color1Handle, color1);
  gl.uniform3fv(color2Handle, color2);
  gl.uniform3fv(bgColorHandle, bgColor);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  window.frameId = requestAnimationFrame(loop);
}

function getVertexShader() {
  return /*glsl*/`
  attribute vec2 position;

  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
  `;
}

function getFragmentShader() {
  return /*glsl*/`
  precision highp float;

  const float WIDTH = ${width >> 0}.0;
  const float HEIGHT = ${height >> 0}.0;

  uniform vec3 blobs[${blobs.length}];
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 bgColor;

  void main(){
  float x = gl_FragCoord.x;
  float y = gl_FragCoord.y;
  vec2 st = gl_PointCoord;

  // how close pixel is to blobs
  float sum = 0.0;
  for (int i = 0; i < ${blobs.length}; i++) {
    vec3 blob = blobs[i];
    float dx = blob.x - x;
    float dy = blob.y - y;
    float radius = blob.z;

    // inverse of the distance from blob's center
    // weighted by blob's radius
    sum += (radius*radius) / (dx * dx + dy * dy);
  }

  if (sum >= 2.0 - float(${blobStickiness})) {
    vec3 color = mix(color2, color1, y / HEIGHT);
    gl_FragColor = vec4(color, 1.0);
    return;
  }

  gl_FragColor = vec4(bgColor, 1.0);
  }
  `;
}

function webglSetup() {
  var vertexShader = compileShader(getVertexShader(), gl.VERTEX_SHADER);
  var fragmentShader = compileShader(getFragmentShader(), gl.FRAGMENT_SHADER);

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  var vertexData = new Float32Array([
    -1.0, 1.0,
    -1.0, -1.0,
    1.0, 1.0,
    1.0, -1.0,
  ]);
  var vertexDataBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

  var positionHandle = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionHandle);
  gl.vertexAttribPointer(positionHandle,
    2, // position is a vec2
    gl.FLOAT, // each component is a float
    gl.FALSE, // don't normalize values
    2 * 4, // two 4 byte float components per vertex
    0 // offset into each span of vertex data
  );

  blobsHandle = gl.getUniformLocation(program, 'blobs');
  color1Handle = gl.getUniformLocation(program, 'color1');
  color2Handle = gl.getUniformLocation(program, 'color2');
  bgColorHandle = gl.getUniformLocation(program, 'bgColor');
}

function compileShader(shaderSource, shaderType) {
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
  }

  return shader;
}

blobs = getBlobs(10);
startAnimation();