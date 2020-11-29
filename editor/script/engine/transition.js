var TransitionManager = function() {
	var curEffect = null;

	var transitionStart = null;
	var transitionEnd = null;
	var transitionTextureId = null;

	var isTransitioning = false;
	var transitionTime = 0; // milliseconds
	var frameRate = 8; // cap the FPS
	var prevStep = -1; // used to avoid running post-process effect constantly

	this.BeginTransition = function(startRoom, startX, startY, endRoom, endX, endY, effectId, onInitNextRoom) {
		curEffect = null;

		if (effectId in transitionEffects) {
			curEffect = transitionEffects[effectId];
		}

		var tmpRoom = player().room;
		var tmpX = player().x;
		var tmpY = player().y;

		if (curEffect.showPlayerStart) {
			player().room = startRoom;
			player().x = startX;
			player().y = startY;
		}
		else {
			// todo : will this break anything?
			player().x = -1;
			player().y = -1;
		}

		var startBuffer = (curEffect.type === EffectType.Tile) ? renderer.CreateTileBufferTarget() : renderer.CreateBufferTarget();
		drawRoom(room[startRoom], { target: startBuffer, });
		transitionStart = new TransitionInfo(startBuffer, PALETTE_ID.PREV, startX, startY);

		if (curEffect.showPlayerEnd) {
			player().room = endRoom;
			player().x = endX;
			player().y = endY;
		}
		else {
			player().x = -1;
			player().y = -1;
		}

		onInitNextRoom(endRoom);

		var endBuffer = (curEffect.type === EffectType.Tile) ? renderer.CreateTileBufferTarget() : renderer.CreateBufferTarget();
		drawRoom(room[endRoom], { target: endBuffer, });
		transitionEnd = new TransitionInfo(endBuffer, PALETTE_ID.ROOM, endX, endY);

		var textureSize = roomsize * tilesize * scale;
		transitionTextureId = bitsyTextureCreate(textureSize, textureSize);

		isTransitioning = true;
		transitionTime = 0;
		prevStep = -1;

		player().room = tmpRoom;
		player().x = tmpX;
		player().y = tmpY;

		// set palette for clearing screen
		if ("clearIndex" in curEffect) {
			color.CreateFadePalette(curEffect.clearIndex);
		}
	}

	function EndTransition() {
		curEffect = null;

		isTransitioning = false;
		transitionTime = 0;
		transitionStart = null;
		transitionEnd = null;
		prevStep = -1;

		bitsyTextureRelease(transitionTextureId);
		transitionTextureId = null;

		color.UpdateSystemPalette();

		if (transitionCompleteCallback != null) {
			transitionCompleteCallback();
		}
		transitionCompleteCallback = null;
	}

	this.UpdateTransition = function(dt) {
		if (!isTransitioning) {
			return;
		}

		transitionTime += dt;

		var transitionDelta = transitionTime / curEffect.duration;
		var maxStep = Math.floor(frameRate * (curEffect.duration / 1000));
		var step = Math.floor(transitionDelta * maxStep);

		if (step != prevStep) {
			if ("type" in curEffect && curEffect.type === EffectType.Tile) {
				UpdateTileEffect(curEffect, step, maxStep);
			}
			else {
				UpdatePixelEffect(curEffect, step, maxStep);
			}
		}

		prevStep = step;

		if (transitionTime >= curEffect.duration) {
			EndTransition();
		}
	}

	// todo : pass in other parameters?
	function UpdatePixelEffect(effect, step, maxStep) {
		effect.onStep(transitionStart, transitionEnd, (step / maxStep));

		for (var y = 0; y < transitionStart.Buffer.Height; y++) {
			for (var x = 0; x < transitionStart.Buffer.Width; x++) {

				var effectColorIndex = effect.pixelEffectFunc(
					transitionStart,
					transitionEnd,
					x,
					y,
					(step / maxStep));

				bitsyTextureSetPixel(transitionTextureId, x, y, scale, effectColorIndex);
			}
		}

		bitsyCanvasPutTexture(transitionTextureId, 0, 0);
	}

	function UpdateTileEffect(effect, step, maxStep) {
		renderer.ResetRenderCache();

		// kind of hacky (?) way to allow drawing to empty spaces during transitions
		renderer.SetTileSource(NULL_ID, createGrid(tilesize, 0));

		effect.onStep(transitionStart, transitionEnd, (step / maxStep));

		var screenTarget = renderer.CreateScreenTarget();
		screenTarget.Clear();

		for (var y = 0; y < transitionStart.Buffer.Height; y++) {
			for (var x = 0; x < transitionStart.Buffer.Width; x++) {
				var drawing = effect.tileEffectFunc(transitionStart, transitionEnd, x, y, step);
				screenTarget.DrawSprite(drawing, x, y);
			}
		}
	}

	this.IsTransitionActive = function() {
		return isTransitioning;
	}

	// todo : should this be part of the constructor?
	var transitionCompleteCallback = null;
	this.OnTransitionComplete = function(callback) {
		if (isTransitioning) { // TODO : safety check necessary?
			transitionCompleteCallback = callback;
		}
	}

	var transitionEffects = {};
	this.RegisterTransitionEffect = function(name, effect) {
		transitionEffects[name] = effect;
	}

	// todo : name? // todo : remove?
	this.RegisterTransitionEffect("NONE", {
		showPlayerStart : false,
		showPlayerEnd : false,
		duration : 500,
		onStep : function() {},
		pixelEffectFunc : function() {},
	});

	function onStepFade(start, end, delta) {
		var palIdA = delta < 0.5 ? start.PaletteId : PALETTE_ID.FADE;
		var palIdB = delta < 0.5 ? PALETTE_ID.FADE : end.PaletteId;

		delta = delta < 0.5 ? (delta / 0.5) : ((delta - 0.5) / 0.5); // hacky

		color.UpdateSystemPalette(palIdA, palIdB, delta);
	}

	function pixelEffectFade(start, end, pixelX, pixelY, delta) {
		var curBuffer = delta < 0.5 ? start.Buffer : end.Buffer;
		return curBuffer.GetPixel(pixelX, pixelY);
	}

	this.RegisterTransitionEffect(TRANSITION_KEY.FADE_WHITE, { // TODO : have it linger on full white briefly?
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 750,
		clearIndex : COLOR_INDEX.TEXT,
		onStep : onStepFade,
		pixelEffectFunc : pixelEffectFade,
	});

	this.RegisterTransitionEffect(TRANSITION_KEY.FADE_BLACK, {
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 750,
		clearIndex : COLOR_INDEX.TEXTBOX,
		onStep : onStepFade,
		pixelEffectFunc : pixelEffectFade,
	});

	// todo : name? WVY? WAV?
	this.RegisterTransitionEffect(TRANSITION_KEY.WAVE, {
		showPlayerStart : true,
		showPlayerEnd : true,
		duration : 1500,
		onStep : function(start, end, delta) {
			var curPalId = delta < 0.5 ? start.PaletteId : end.PaletteId;
			color.UpdateSystemPalette(curPalId);
		},
		pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
			var waveDelta = delta < 0.5 ? delta / 0.5 : 1 - ((delta - 0.5) / 0.5);

			var offset = (pixelY + (waveDelta * waveDelta * 0.2 * start.Buffer.Height));
			var freq = 4;
			var size = 2 + (14 * waveDelta);
			pixelX += Math.floor(Math.sin(offset / freq) * size);

			if (pixelX < 0) {
				pixelX += start.Buffer.Width;
			}
			else if (pixelX >= start.Buffer.Width) {
				pixelX -= start.Buffer.Width;
			}

			var curBuffer = delta < 0.5 ? start.Buffer : end.Buffer;
			return curBuffer.GetPixel(pixelX, pixelY);
		},
	});

	this.RegisterTransitionEffect(TRANSITION_KEY.TUNNEL, {
		showPlayerStart : true,
		showPlayerEnd : true,
		duration : 1500,
		onStep : function(start, end, delta) {
			if (delta <= 0.4) {
				color.UpdateSystemPalette(start.PaletteId);
			}
			else if (delta <= 0.6) {
				var paletteDelta = (delta - 0.4) / 0.2;
				color.UpdateSystemPalette(start.PaletteId, end.PaletteId, paletteDelta);
			}
			else {
				color.UpdateSystemPalette(end.PaletteId);
			}
		},
		pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
			var palIndex = COLOR_INDEX.TEXTBOX;

			if (delta <= 0.4) {
				var tunnelDelta = 1 - (delta / 0.4);

				var xDist = start.PlayerCenter.x - pixelX;
				var yDist = start.PlayerCenter.y - pixelY;
				var dist = Math.sqrt((xDist * xDist) + (yDist * yDist));

				var palIndex = COLOR_INDEX.TEXTBOX;

				if (dist > start.Buffer.Width * tunnelDelta) {
					// do nothing
				}
				else {
					palIndex = start.Buffer.GetPixel(pixelX, pixelY);
				}
			}
			else if (delta <= 0.6) {
				return COLOR_INDEX.TEXTBOX;
			}
			else {
				var tunnelDelta = (delta - 0.6) / 0.4;

				var xDist = end.PlayerCenter.x - pixelX;
				var yDist = end.PlayerCenter.y - pixelY;
				var dist = Math.sqrt((xDist * xDist) + (yDist * yDist));

				if (dist > end.Buffer.Width * tunnelDelta) {
					// do nothing
				}
				else {
					palIndex = end.Buffer.GetPixel(pixelX, pixelY);
				}
			}

			return palIndex;
		},
	});

	function onStepSlide(start, end, delta) {
		var paletteDelta = clampLerp(delta, 0.4);
		color.UpdateSystemPalette(start.PaletteId, end.PaletteId, paletteDelta);
	}

	this.RegisterTransitionEffect(TRANSITION_KEY.SLIDE_UP, {
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 1000,
		onStep: onStepSlide,
		pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
			var pixelOffset = -1 * Math.floor(start.Buffer.Height * delta);
			var slidePixelY = pixelY + pixelOffset;

			if (slidePixelY >= 0) {
				return start.Buffer.GetPixel(pixelX, slidePixelY);
			}
			else {
				slidePixelY += start.Buffer.Height;
				return end.Buffer.GetPixel(pixelX, slidePixelY);
			}
		},
	});

	this.RegisterTransitionEffect(TRANSITION_KEY.SLIDE_DOWN, {
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 1000,
		onStep: onStepSlide,
		pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
			var pixelOffset = Math.floor(start.Buffer.Height * delta);
			var slidePixelY = pixelY + pixelOffset;

			if (slidePixelY < start.Buffer.Height) {
				return start.Buffer.GetPixel(pixelX, slidePixelY);
			}
			else {
				slidePixelY -= start.Buffer.Height;
				return end.Buffer.GetPixel(pixelX, slidePixelY);
			}
		},
	});

	this.RegisterTransitionEffect(TRANSITION_KEY.SLIDE_LEFT, {
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 1000,
		onStep: onStepSlide,
		pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
			var pixelOffset = -1 * Math.floor(start.Buffer.Width * delta);
			var slidePixelX = pixelX + pixelOffset;

			if (slidePixelX >= 0) {
				return start.Buffer.GetPixel(slidePixelX, pixelY);
			}
			else {
				slidePixelX += start.Buffer.Width;
				return end.Buffer.GetPixel(slidePixelX, pixelY);
			}
		},
	});

	this.RegisterTransitionEffect(TRANSITION_KEY.SLIDE_RIGHT, {
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 1000,
		onStep: onStepSlide,
		pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
			var pixelOffset = Math.floor(start.Buffer.Width * delta);
			var slidePixelX = pixelX + pixelOffset;

			if (slidePixelX < start.Buffer.Width) {
				return start.Buffer.GetPixel(slidePixelX, pixelY);
			}
			else {
				slidePixelX -= start.Buffer.Width;
				return end.Buffer.GetPixel(slidePixelX, pixelY);
			}
		},
	});

	var EffectType = {
		Pixel : 0,
		Tile : 0,
	};

	// TODO : WIP prototype
	// function CreateTileEffect() {
	// 	var script = // TODO

	// 	function CreateTileInfoTable(tileInfo) {
	// 		var table = new Table();
	// 		table.Set("DRW", tileInfo.drw);
	// 		table.Set("COL", tileInfo.col);
	// 		table.Set("BGC", tileInfo.bgc);
	// 		return table;
	// 	}

	// 	var effect = {
	// 		type : EffectType.Tile,
	// 		showPlayerStart : false,
	// 		showPlayerEnd : true,
	// 		duration : 1000,
	// 		onStep : function(start, end, delta) {
	// 			color.UpdateSystemPalette(start.PaletteId, end.PaletteId, delta);
	// 		},
	// 		tileEffectFunc : function(start, end, tileX, tileY, step) {
	// 			var result = {
	// 				drw: "0",
	// 				col: 0,
	// 				bgc: 0,
	// 				colorOffset: COLOR_INDEX.BACKGROUND,
	// 				animation: { isAnimated: false, frameIndex: 0, frameCount: 1, },
	// 			};

	// 			var startTile = CreateTileInfoTable(start.Buffer.GetTile(tileX, tileY));
	// 			var endTile = CreateTileInfoTable(end.Buffer.GetTile(tileX, tileY));

	// 			scriptInterpreter.RunCallback(
	// 				script,
	// 				null,
	// 				[tileX, tileY, startTile, endTile, step], // param order?
	// 				function(out) {
	// 					if (out) {
	// 						if (out.Has("DRW")) {
	// 							result.drw = out.Get("DRW");
	// 						}

	// 						if (out.Has("COL")) {
	// 							result.col = out.Get("COL");
	// 						}

	// 						if (out.Has("BGC")) {
	// 							result.bgc = out.Get("BGC");
	// 						}
	// 					}
	// 				});

	// 			if (result.drw in tile) {
	// 				// todo : will this cause any bugs to access the global animation state?
	// 				result.animation = tile[result.drw].animation;
	// 			}

	// 			return result;
	// 		},
	// 	};

	// 	return effect;
	// }

	function clampLerp(deltaIn, clampDuration) {
		var clampOffset = (1.0 - clampDuration) / 2;
		var deltaOut = Math.min(clampDuration, Math.max(0.0, deltaIn - clampOffset)) / clampDuration;
		return deltaOut;
	}
}; // TransitionManager()

var TransitionInfo = function(pixelBuffer, paletteId, playerX, playerY) {
	this.Buffer = pixelBuffer;
	this.PaletteId = paletteId;
	this.PlayerTilePos = { x: playerX, y: playerY };
	this.PlayerCenter = { x: Math.floor((playerX * tilesize) + (tilesize / 2)), y: Math.floor((playerY * tilesize) + (tilesize / 2)) };
};