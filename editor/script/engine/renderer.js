function Renderer(roomsize, tilesize, scale) {

var cache = {
	source: {},
	render: {},
};

var debugRenderCount = 0;

function renderTileFrame(drawing, frameOverride) {
	var frameIndex = getFrameIndex(drawing, frameOverride);
	var frameSource = cache.source[drawing.id][frameIndex];
	var backgroundIndex = drawing.colorOffset + drawing.bgc;
	var colorIndex = drawing.colorOffset + drawing.col;
	return createTextureFromTileSource(frameSource, backgroundIndex, colorIndex);
}

function createTextureFromTileSource(tileSource, bgcIndex, colIndex) {
	var textureId = bitsyTextureCreate(tilesize * scale, tilesize * scale);

	var backgroundColor = color.GetColor(bgcIndex);
	var foregroundColor = color.GetColor(colIndex);

	for (var y = 0; y < tilesize; y++) {
		for (var x = 0; x < tilesize; x++) {
			var px = tileSource[y][x];

			var r = backgroundColor[0];
			var g = backgroundColor[1];
			var b = backgroundColor[2];
			var a = backgroundColor[3];

			if (px === 1 && foregroundColor[3] > 0) {
				r = foregroundColor[0];
				g = foregroundColor[1];
				b = foregroundColor[2];
				a = foregroundColor[3];
			}

			bitsyTextureSetPixel(textureId, x, y, scale, r, g, b, a);
		}
	}

	bitsyTextureCommit(textureId);

	return textureId;
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

function resetAllTextures() {
	for (var id in cache.render) {
		var textureId = cache.render[id];
		bitsyTextureRelease(textureId);

		delete cache.render[id];
	}
}

/* PUBLIC INTERFACE */
this.GetRenderedTile = getOrRenderTile;

this.SetTileSource = function(drawingId, sourceData) {
	cache.source[drawingId] = sourceData;

	// render cache is now out of date!
	resetAllTextures(); // todo : will this cause problems?
}

this.GetTileSource = function(drawingId) {
	return cache.source[drawingId];
}

this.GetFrameCount = function(drawingId) {
	return cache.source[drawingId].length;
}

this.ResetRenderCache = function() {
	resetAllTextures();
}

/* RENDER Context */
function RenderContext() {
	var width = roomsize * tilesize * scale;
	var height = roomsize * tilesize * scale;
	var tileIncrement = tilesize * scale;

	this.Clear = function() {
		var backgroundColor = color.GetColor(COLOR_INDEX.BACKGROUND);
		bitsyCanvasClear(backgroundColor[0], backgroundColor[1], backgroundColor[2]);
	};

	function Draw(drawing, x, y, options) {
		var frameOverride = options && options.frameIndex ? options.frameIndex : null;

		var renderedTile = getOrRenderTile(drawing, frameOverride);
		bitsyCanvasPutTexture(renderedTile, x * tileIncrement, y * tileIncrement);
	}

	this.DrawTile = function(tileId, x, y, options) {
		Draw(tile[tileId], x, y, options);
	};

	this.DrawSprite = function(sprite, x, y, options) {
		Draw(sprite, x, y, options);
	};
}

this.CreateContext = function() {
	return new RenderContext();
}

// todo : name?
function PaletteIndexRenderContext() {
	var width = roomsize * tilesize;
	var height = roomsize * tilesize;

	var pixelData = new Array(width * height);

	this.Clear = function() {
		pixelData.fill(COLOR_INDEX.BACKGROUND, 0, width * height);
	};

	function Draw(drawing, x, y, options) {
		var frameOverride = options && options.frameIndex ? options.frameIndex : null;
		var frameIndex = getFrameIndex(drawing, frameOverride);
		var frameData = cache.source[drawing.drw][frameIndex];

		var backgroundIndex = color.GetColorIndex(drawing.colorOffset + drawing.bgc);
		var foregroundIndex = color.GetColorIndex(drawing.colorOffset + drawing.col);

		for (var dy = 0; dy < tilesize; dy++) {
			for (var dx = 0; dx < tilesize; dx++) {
				// todo : catch index out of bounds?
				var pixelIndex = (width * (y + dy)) + (x + dx);

				if (frameData[dy][dx] === 1 && foregroundIndex != COLOR_INDEX.TRANSPARENT) {
					pixelData[pixelIndex] = foregroundIndex;
				}
				else if (backgroundIndex != COLOR_INDEX.TRANSPARENT) {
					pixelData[pixelIndex] = backgroundIndex;
				}
			}
		}
	}

	this.DrawTile = function(tileId, x, y, options) {
		Draw(tile[tileId], x, y, options);
	};

	this.DrawSprite = function(sprite, x, y, options) {
		Draw(sprite, x, y, options);
	};
}

this.CreatePaletteIndexContext = function() {
	return new PaletteIndexRenderContext();
}

} // Renderer()