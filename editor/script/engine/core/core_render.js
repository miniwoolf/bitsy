// todo : should these really be free floating globals?
var canvas;
var context;

var textureCache = {};
var nextTextureId = 0;

// todo : move max palette size into here?
var paletteMemory = [];

function bitsyCanvasAttach(canvasIn, renderSize) {
	canvas = canvasIn;
	canvas.width = renderSize;
	canvas.height = renderSize;
	context = canvas.getContext("2d");
}

function bitsyCanvasClear(colorIndex) {
	var color = paletteMemory[colorIndex];
	context.fillStyle = "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
	context.fillRect(0, 0, canvas.width, canvas.height);
}

function bitsyCanvasPutTexture(textureId, x, y) {
	if (textureCache[textureId].canvas != null) {
		context.drawImage(
			textureCache[textureId].canvas,
			x,
			y,
			textureCache[textureId].img.width,
			textureCache[textureId].img.height);
	}
	else {
		context.putImageData(textureCache[textureId].img, x, y);
	}
}

function bitsyTextureCreate(width, height) {
	var textureId = nextTextureId;
	nextTextureId++;

	textureCache[textureId] = {
		img: context.createImageData(width, height),
		canvas: null,
	};

	return textureId;
}

// todo : revisit how I handle pixel scaling?
function bitsyTextureSetPixel(textureId, x, y, scale, colorIndex) {
	var img = textureCache[textureId].img;
	var color = (colorIndex >= 0 && colorIndex < paletteMemory.length) ? paletteMemory[colorIndex] : paletteMemory[0];

	if (!color) {
		color = [255, 0, 255, 255]; // error!
		// console.log("could not find color " + colorIndex);
		// console.log(paletteMemory);
	}

	for (var sy = 0; sy < scale; sy++) {
		for (var sx = 0; sx < scale; sx++) {
			var pxl = (((y * scale) + sy) * img.width * 4) + (((x * scale) + sx) * 4);

			img.data[pxl + 0] = color[0];
			img.data[pxl + 1] = color[1];
			img.data[pxl + 2] = color[2];
			img.data[pxl + 3] = color[3];
		}
	}
}

function bitsyTextureFill(textureId, colorIndex) {
	var img = textureCache[textureId].img;
	var color = (colorIndex >= 0 && colorIndex < paletteMemory.length) ? paletteMemory[colorIndex] : paletteMemory[0];

	for (var i = 0; i < img.data.length; i += 4) {
		img.data[i + 0] = color[0];
		img.data[i + 1] = color[1];
		img.data[i + 2] = color[2];
		img.data[i + 3] = color[3];
	}
}

// signal we're done drawing to this texture
function bitsyTextureCommit(textureId) {
	var img = textureCache[textureId].img;

	// convert to canvas: chrome has poor performance when working directly with image data
	var imageCanvas = document.createElement("canvas");
	imageCanvas.width = img.width;
	imageCanvas.height = img.height;
	var imageContext = imageCanvas.getContext("2d");
	imageContext.putImageData(img, 0, 0);

	textureCache[textureId].canvas = imageCanvas;
}

function bitsyTextureRelease(textureId) {
	delete textureCache[textureId];
}

// todo : return success or fail bool?
function bitsyPaletteRequestSize(size) {
	paletteMemory = [];

	for (var i = 0; i < size; i++) {
		paletteMemory.push([0, 0, 0, 255]);
	}

	// console.log(paletteMemory);
}

function bitsyPaletteSetColor(index, r, g, b, a) {
	paletteMemory[index] = [r, g, b, a];
}

function bitsyPaletteIsTransparent(index) {
	return index < paletteMemory.length ? paletteMemory[index][3] === 0 : false;
}