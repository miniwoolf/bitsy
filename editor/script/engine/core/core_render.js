// todo : should these really be free floating globals?
var canvas;
var context;
var textureCache = {};
var nextTextureId = 0;

function bitsyCanvasAttach(canvasIn, renderSize) {
	canvas = canvasIn;
	canvas.width = renderSize;
	canvas.height = renderSize;
	context = canvas.getContext("2d");
}

function bitsyCanvasClear(r, g, b) {
	context.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
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
function bitsyTextureSetPixel(textureId, x, y, scale, r, g, b, a) {
	var img = textureCache[textureId].img;

	for (var sy = 0; sy < scale; sy++) {
		for (var sx = 0; sx < scale; sx++) {
			var pxl = (((y * scale) + sy) * img.width * 4) + (((x * scale) + sx) * 4);

			img.data[pxl + 0] = r;
			img.data[pxl + 1] = g;
			img.data[pxl + 2] = b;
			img.data[pxl + 3] = a;
		}
	}
}

function bitsyTextureFill(textureId, r, g, b, a) {
	var img = textureCache[textureId].img;

	for (var i = 0; i < img.data.length; i += 4) {
		img.data[i + 0] = r;
		img.data[i + 1] = g;
		img.data[i + 2] = b;
		img.data[i + 3] = a;
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