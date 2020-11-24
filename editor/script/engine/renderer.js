/* TODO
 - sprite batching?
*/

function Renderer(roomsize, tilesize, scale) {

var cache = {
	source: {},
	render: {},
};

var debugRenderCount = 0;

function renderTileFrame(drawing, frameOverride) {
	var frameIndex = getFrameIndex(drawing, frameOverride);
	var frameSource = cache.source[drawing.drw][frameIndex];
	var backgroundIndex = drawing.colorOffset + drawing.bgc;
	var colorIndex = drawing.colorOffset + drawing.col;
	return createTextureFromTileSource(frameSource, backgroundIndex, colorIndex);
}

function createTextureFromTileSource(tileSource, bgcIndex, colIndex) {
	var textureId = bitsyTextureCreate(tilesize * scale, tilesize * scale);

	var foregroundColorIndex = color.GetColorIndex(colIndex);
	var backgroundColorIndex = color.GetColorIndex(bgcIndex);
	if (bitsyPaletteIsTransparent(foregroundColorIndex)) {
		foregroundColorIndex = backgroundColorIndex;
	}

	for (var y = 0; y < tilesize; y++) {
		for (var x = 0; x < tilesize; x++) {
			var px = tileSource[y][x];
			var colorIndex = (px === 1) ? foregroundColorIndex : backgroundColorIndex;

			if (colorIndex < 0 || colorIndex >= color.RoomPaletteSize()) {
				colorIndex = COLOR_INDEX.BACKGROUND;
			}

			bitsyTextureSetPixel(textureId, x, y, scale, colorIndex);
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

function ScreenRenderTarget() {
	var width = roomsize * tilesize * scale;
	var height = roomsize * tilesize * scale;
	var tileIncrement = tilesize * scale;

	this.Clear = function() {
		bitsyCanvasClear(COLOR_INDEX.BACKGROUND);
	};

	function Draw(drawing, x, y, options) {
		var frameOverride = options && options.frameIndex ? options.frameIndex : null;

		if (drawing.id in tile) {
			var renderedTile = getOrRenderTile(drawing, frameOverride);
			bitsyCanvasPutTexture(renderedTile, x * tileIncrement, y * tileIncrement);
		}
		else {
			console.log("TRYING TO DRAW MISSING TILE " + drawing.id);
		}
	}

	this.DrawTile = function(tileId, x, y, options) {
		Draw(tile[tileId], x, y, options);
	};

	this.DrawSprite = function(sprite, x, y, options) {
		if (sprite === undefined) {
			console.log("TRYING TO DRAW MISSING SPRITE!");
			return;
		}

		Draw(sprite, x, y, options);
	};
}

this.CreateScreenTarget = function() {
	return new ScreenRenderTarget();
};

function PaletteIndexBufferRenderTarget() {
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

		var top = y * tilesize;
		var left = x * tilesize;

		for (var dy = 0; dy < tilesize; dy++) {
			for (var dx = 0; dx < tilesize; dx++) {
				// todo : catch index out of bounds?
				var pixelIndex = (width * (top + dy)) + (left + dx);

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

	this.Width = width;
	this.Height = height;

	this.GetPixel = function(x, y) {
		return pixelData[(y * width) + x];
	};
}

this.CreateBufferTarget = function() {
	return new PaletteIndexBufferRenderTarget();
};

function TilemapBufferRenderTarget() {
	var width = roomsize;
	var height = roomsize;

	var tilemapData = [];

	this.Clear = function() {
		for (var i = 0; i < width * height; i++) {
			tilemapData.push({ drw: "0", col: 0, bgc: 0, });
		}
	};

	function Draw(drawing, x, y, options) {
		tilemapData[(parseInt(y) * width) + parseInt(x)] = {
			drw: drawing.drw,
			col: drawing.col,
			bgc: drawing.bgc,
		};
	}

	this.DrawTile = function(tileId, x, y, options) {
		Draw(tile[tileId], x, y, options);
	};

	this.DrawSprite = function(sprite, x, y, options) {
		Draw(sprite, x, y, options);
	};

	this.Width = width;
	this.Height = height;

	this.GetTile = function(x, y) {
		return tilemapData[(y * width) + x];
	};
}

this.CreateTileBufferTarget = function() {
	return new TilemapBufferRenderTarget();
};

} // Renderer()