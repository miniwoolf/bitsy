function Renderer(tilesize, scale) {

var cache = {
	source: {},
	render: {},
};

var context = null;

var debugRenderCount = 0;

function renderTileFrame(drawing, frameOverride) {
	var frameIndex = getFrameIndex(drawing, frameOverride);
	var frameSource = cache.source[drawing.id][frameIndex];
	var backgroundIndex = drawing.colorOffset + drawing.bgc;
	var colorIndex = drawing.colorOffset + drawing.col;
	var frameData = imageDataFromTileSource(frameSource, backgroundIndex, colorIndex);
	return frameData;
}

function imageDataFromTileSource(tileSource, bgcIndex, colIndex) {
	var img = context.createImageData(tilesize * scale, tilesize * scale);

	var backgroundColor = color.GetColor(bgcIndex);
	var foregroundColor = color.GetColor(colIndex);

	for (var y = 0; y < tilesize; y++) {
		for (var x = 0; x < tilesize; x++) {
			var px = tileSource[y][x];
			for (var sy = 0; sy < scale; sy++) {
				for (var sx = 0; sx < scale; sx++) {
					var pxl = (((y * scale) + sy) * tilesize * scale * 4) + (((x*scale) + sx) * 4);
					if (px === 1 && foregroundColor[3] > 0) {
						img.data[pxl + 0] = foregroundColor[0];
						img.data[pxl + 1] = foregroundColor[1];
						img.data[pxl + 2] = foregroundColor[2];
						img.data[pxl + 3] = foregroundColor[3];
					}
					else {
						img.data[pxl + 0] = backgroundColor[0];
						img.data[pxl + 1] = backgroundColor[1];
						img.data[pxl + 2] = backgroundColor[2];
						img.data[pxl + 3] = backgroundColor[3];
					}
				}
			}
		}
	}

	// convert to canvas: chrome has poor performance when working directly with image data
	var imageCanvas = document.createElement("canvas");
	imageCanvas.width = img.width;
	imageCanvas.height = img.height;
	var imageContext = imageCanvas.getContext("2d");
	imageContext.putImageData(img, 0, 0);

	return imageCanvas;
}

function getCacheId(drawingId, frameIndex, backgroundIndex, colorIndex) {
	return "drw" + drawingId + "_f" + frameIndex + "_b" + backgroundIndex + "_c" + colorIndex;
}

function getFrameIndex(drawing, frameOverride) {
	var frameIndex = 0;
	if (drawing.animation.isAnimated) {
		if (frameOverride != undefined && frameOverride != null) {
			frameIndex = frameOverride;
		}
		else {
			frameIndex = drawing.animation.frameIndex;
		}
	}

	return frameIndex;
}

function getCacheIdFromDrawing(drawing, frameOverride) {
	var frameIndex = getFrameIndex(drawing, frameOverride);
	var backgroundIndex = color.GetColorIndex(drawing.colorOffset + drawing.bgc);
	var colorIndex = color.GetColorIndex(drawing.colorOffset + drawing.col);

	return getCacheId(drawing.drw, frameIndex, backgroundIndex, colorIndex);
}

function getOrRenderTile(drawing, frameOverride) {
	var renderCacheId = getCacheIdFromDrawing(drawing, frameOverride);

	if (!(renderCacheId in cache.render)) {
		cache.render[renderCacheId] = renderTileFrame(drawing, frameOverride);
	}

	return cache.render[renderCacheId];
}

/* PUBLIC INTERFACE */
this.GetRenderedTile = getOrRenderTile;

this.SetTileSource = function(drawingId, sourceData) {
	cache.source[drawingId] = sourceData;

	// render cache is now out of date!
	cache.render = {}; // todo : will this cause problems?
}

this.GetTileSource = function(drawingId) {
	return cache.source[drawingId];
}

this.GetFrameCount = function(drawingId) {
	return cache.source[drawingId].length;
}

this.AttachContext = function(ctx) {
	context = ctx;
}

this.ResetRenderCache = function() {
	cache.render = {};
}

} // Renderer()