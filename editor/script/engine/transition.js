var TransitionManager = function() {
	var transitionStart = null;
	var transitionEnd = null;
	var transitionTextureId = null;

	var isTransitioning = false;
	var transitionTime = 0; // milliseconds
	var frameRate = 8; // cap the FPS
	var prevStep = -1; // used to avoid running post-process effect constantly

	this.BeginTransition = function(startRoom, startX, startY, endRoom, endX, endY, effectName, onInitNextRoom) {
		// console.log("--- START ROOM TRANSITION ---");

		curEffect = effectName;

		var tmpRoom = player().room;
		var tmpX = player().x;
		var tmpY = player().y;

		if (transitionEffects[curEffect].showPlayerStart) {
			player().room = startRoom;
			player().x = startX;
			player().y = startY;
		}
		else {
			// todo : will this break anything?
			player().x = -1;
			player().y = -1;
		}

		console.log(player().x);

		var startBuffer = renderer.CreateBufferTarget();
		drawRoom(room[startRoom], { target: startBuffer, });
		transitionStart = new TransitionInfo(startBuffer, PALETTE_ID.PREV, startX, startY);

		if (transitionEffects[curEffect].showPlayerEnd) {
			player().room = endRoom;
			player().x = endX;
			player().y = endY;
		}
		else {
			player().x = -1;
			player().y = -1;
		}

		onInitNextRoom(endRoom);

		var endBuffer = renderer.CreateBufferTarget();
		drawRoom(room[endRoom], { target: endBuffer, });
		transitionEnd = new TransitionInfo(endBuffer, PALETTE_ID.ACTIVE, endX, endY);

		var textureSize = roomsize * tilesize * scale;
		transitionTextureId = bitsyTextureCreate(textureSize, textureSize);

		isTransitioning = true;
		transitionTime = 0;
		prevStep = -1;

		player().room = tmpRoom;
		player().x = tmpX;
		player().y = tmpY;

		// set palette for clearing screen
		if ("clearIndex" in transitionEffects[curEffect]) {
			color.UpdateClearPalette(PALETTE_ID.PREV, transitionEffects[curEffect].clearIndex);
		}
	}

	function EndTransition() {
		isTransitioning = false;
		transitionTime = 0;
		transitionStart = null;
		transitionEnd = null;
		prevStep = -1;

		bitsyTextureRelease(transitionTextureId);
		transitionTextureId = null;

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

		var transitionDelta = transitionTime / transitionEffects[curEffect].duration;
		var maxStep = Math.floor(frameRate * (transitionEffects[curEffect].duration / 1000));
		var step = Math.floor(transitionDelta * maxStep);

		if (step != prevStep) {
			for (var y = 0; y < transitionStart.Buffer.Height; y++) {
				for (var x = 0; x < transitionStart.Buffer.Width; x++) {
					var effectColor = transitionEffects[curEffect].pixelEffectFunc(
						transitionStart,
						transitionEnd,
						x,
						y,
						(step / maxStep));

					bitsyTextureSetPixel(transitionTextureId, x, y, scale, effectColor[0], effectColor[1], effectColor[2], 255);
				}
			}

			bitsyCanvasPutTexture(transitionTextureId, 0, 0);
		}

		prevStep = step;

		if (transitionTime >= transitionEffects[curEffect].duration) {
			EndTransition();
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
	var curEffect = "none";
	this.RegisterTransitionEffect = function(name, effect) {
		transitionEffects[name] = effect;
	}

	this.RegisterTransitionEffect("none", {
		showPlayerStart : false,
		showPlayerEnd : false,
		pixelEffectFunc : function() {},
	});

	this.RegisterTransitionEffect("fade_w", { // TODO : have it linger on full white briefly?
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 750,
		clearIndex : COLOR_INDEX.TEXT,
		pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
			var curBuffer = delta < 0.5 ? start.Buffer : end.Buffer;
			var palIndex = curBuffer.GetPixel(pixelX, pixelY);

			var palIdA = delta < 0.5 ? start.PaletteId : PALETTE_ID.CLEAR;
			var palIdB = delta < 0.5 ? PALETTE_ID.CLEAR : end.PaletteId;

			delta = delta < 0.5 ? (delta / 0.5) : ((delta - 0.5) / 0.5); // hacky

			return color.LerpColor(palIndex, palIdA, palIdB, delta);
		}
	});

	this.RegisterTransitionEffect("fade_b", {
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 750,
		clearIndex : COLOR_INDEX.TEXTBOX,
		// duplicate of previous effect!
		pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
			var curBuffer = delta < 0.5 ? start.Buffer : end.Buffer;
			var palIndex = curBuffer.GetPixel(pixelX, pixelY);

			var palIdA = delta < 0.5 ? start.PaletteId : PALETTE_ID.CLEAR;
			var palIdB = delta < 0.5 ? PALETTE_ID.CLEAR : end.PaletteId;

			delta = delta < 0.5 ? (delta / 0.5) : ((delta - 0.5) / 0.5); // hacky

			return color.LerpColor(palIndex, palIdA, palIdB, delta);
		}
	});

	this.RegisterTransitionEffect("wave", {
		showPlayerStart : true,
		showPlayerEnd : true,
		duration : 1500,
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
			var palIndex = curBuffer.GetPixel(pixelX, pixelY);
			var curPalId = delta < 0.5 ? start.PaletteId : end.PaletteId;
			return color.GetColor(palIndex, curPalId);
		}
	});

	this.RegisterTransitionEffect("tunnel", {
		showPlayerStart : true,
		showPlayerEnd : true,
		duration : 1500,
		pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
			if (delta <= 0.4) {
				var tunnelDelta = 1 - (delta / 0.4);

				var xDist = start.PlayerCenter.x - pixelX;
				var yDist = start.PlayerCenter.y - pixelY;
				var dist = Math.sqrt((xDist * xDist) + (yDist * yDist));

				if (dist > start.Buffer.Width * tunnelDelta) {
					var palIndex = COLOR_INDEX.TEXTBOX;
					return color.GetColor(palIndex, start.PaletteId);
				}
				else {
					var palIndex = start.Buffer.GetPixel(pixelX, pixelY);
					return color.GetColor(palIndex, start.PaletteId);
				}
			}
			else if (delta <= 0.6)
			{
				var colorDelta = (delta - 0.4) / 0.2;
				var palIndex = COLOR_INDEX.TEXTBOX;
				return color.LerpColor(palIndex, start.PaletteId, end.PaletteId, colorDelta);
			}
			else {
				var tunnelDelta = (delta - 0.6) / 0.4;

				var xDist = end.PlayerCenter.x - pixelX;
				var yDist = end.PlayerCenter.y - pixelY;
				var dist = Math.sqrt((xDist * xDist) + (yDist * yDist));

				if (dist > end.Buffer.Width * tunnelDelta) {
					var palIndex = COLOR_INDEX.TEXTBOX;
					return color.GetColor(palIndex, end.PaletteId);
				}
				else {
					var palIndex = end.Buffer.GetPixel(pixelX, pixelY);
					return color.GetColor(palIndex, end.PaletteId);
				}
			}
		}
	});

	this.RegisterTransitionEffect("slide_u", {
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 1000,
		pixelEffectFunc : function(start,end,pixelX,pixelY,delta) {
			var pixelOffset = -1 * Math.floor(start.Buffer.Height * delta);
			var slidePixelY = pixelY + pixelOffset;

			var colorDelta = clampLerp(delta, 0.4);

			if (slidePixelY >= 0) {
				var palIndex = start.Buffer.GetPixel(pixelX, slidePixelY);
				return color.LerpColor(palIndex, start.PaletteId, end.PaletteId, colorDelta);
			}
			else {
				slidePixelY += start.Buffer.Height;
				var palIndex = end.Buffer.GetPixel(pixelX, slidePixelY);
				return color.LerpColor(palIndex, start.PaletteId, end.PaletteId, colorDelta);
			}
		}
	});

	this.RegisterTransitionEffect("slide_d", {
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 1000,
		pixelEffectFunc : function(start,end,pixelX,pixelY,delta) {
			var pixelOffset = Math.floor(start.Buffer.Height * delta);
			var slidePixelY = pixelY + pixelOffset;

			var colorDelta = clampLerp(delta, 0.4);

			if (slidePixelY < start.Buffer.Height) {
				var palIndex = start.Buffer.GetPixel(pixelX, slidePixelY);
				return color.LerpColor(palIndex, start.PaletteId, end.PaletteId, colorDelta);
			}
			else {
				slidePixelY -= start.Buffer.Height;
				var palIndex = end.Buffer.GetPixel(pixelX, slidePixelY);
				return color.LerpColor(palIndex, start.PaletteId, end.PaletteId, colorDelta);
			}
		}
	});

	this.RegisterTransitionEffect("slide_l", {
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 1000,
		pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
			var pixelOffset = -1 * Math.floor(start.Buffer.Width * delta);
			var slidePixelX = pixelX + pixelOffset;

			var colorDelta = clampLerp(delta, 0.4);

			if (slidePixelX >= 0) {
				var palIndex = start.Buffer.GetPixel(slidePixelX, pixelY);
				return color.LerpColor(palIndex, start.PaletteId, end.PaletteId, colorDelta);
			}
			else {
				slidePixelX += start.Buffer.Width;
				var palIndex = end.Buffer.GetPixel(slidePixelX, pixelY);
				return color.LerpColor(palIndex, start.PaletteId, end.PaletteId, colorDelta);
			}
		}
	});

	this.RegisterTransitionEffect("slide_r", {
		showPlayerStart : false,
		showPlayerEnd : true,
		duration : 1000,
		pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
			var pixelOffset = Math.floor(start.Buffer.Width * delta);
			var slidePixelX = pixelX + pixelOffset;

			var colorDelta = clampLerp(delta, 0.4);

			if (slidePixelX < start.Buffer.Width) {
				var palIndex = start.Buffer.GetPixel(slidePixelX, pixelY);
				return color.LerpColor(palIndex, start.PaletteId, end.PaletteId, colorDelta);
			}
			else {
				slidePixelX -= start.Buffer.Width;
				var palIndex = end.Buffer.GetPixel(slidePixelX, pixelY);
				return color.LerpColor(palIndex, start.PaletteId, end.PaletteId, colorDelta);
			}
		}
	});

	function clampLerp(deltaIn, clampDuration) {
		var clampOffset = (1.0 - clampDuration) / 2;
		var deltaOut = Math.min(clampDuration, Math.max(0.0, deltaIn - clampOffset)) / clampDuration;
		return deltaOut;
	}

	// todo : this sort of works but also breaks -- palIndex === undefined - why?
	// TODO : WIP // TODO : do I really want to bring this back?
	// this.RegisterTransitionEffect("fuzz", {
	// 	showPlayerStart : true,
	// 	showPlayerEnd : true,
	// 	duration : 1500,
	// 	pixelEffectFunc : function(start, end, pixelX, pixelY, delta) {
	// 		var curScreen = delta <= 0.5 ? start : end;
	// 		var sampleSize = delta <= 0.5 ? (2 + Math.floor(14 * (delta/0.5))) : (16 - Math.floor(14 * ((delta-0.5)/0.5)));

	// 		var palIndex = 0;

	// 		var sampleX = Math.floor(pixelX / sampleSize) * sampleSize;
	// 		var sampleY = Math.floor(pixelY / sampleSize) * sampleSize;

	// 		var frameState = transitionEffects["fuzz"].frameState;

	// 		if (frameState.time != delta) {
	// 			frameState.time = delta;
	// 			frameState.preCalcSampleValues = {};
	// 		}

	// 		if (frameState.preCalcSampleValues[[sampleX,sampleY]]) {
	// 			palIndex = frameState.preCalcSampleValues[[sampleX,sampleY]];
	// 		}
	// 		else {
	// 			var paletteCount = {};
	// 			var foregroundValue = 1.0;
	// 			var backgroundValue = 0.4;
	// 			for (var y = sampleY; y < sampleY + sampleSize; y++) {
	// 				for (var x = sampleX; x < sampleX + sampleSize; x++) {
	// 					palIndex = curScreen.Buffer.GetPixel(x, y);
	// 					if (palIndex != -1) {
	// 						if (paletteCount[palIndex]) {
	// 							paletteCount[palIndex] += (palIndex != 0) ? foregroundValue : backgroundValue;
	// 						}
	// 						else {
	// 							paletteCount[palIndex] = (palIndex != 0) ? foregroundValue : backgroundValue;
	// 						}
	// 					}
	// 				}
	// 			}

	// 			var maxCount = 0;
	// 			for (var i in paletteCount) {
	// 				if (paletteCount[i] > maxCount) {
	// 					palIndex = i;
	// 					maxCount = paletteCount[i];
	// 				}
	// 			}

	// 			frameState.preCalcSampleValues[[sampleX,sampleY]] = palIndex;
	// 		}

	// 		return color.GetColor(palIndex, curScreen.PaletteId);
	// 	},
	// 	frameState : { // ok this is hacky but it's for performance ok
	// 		time : -1,
	// 		preCalcSampleValues : {}
	// 	},
	// });
}; // TransitionManager()

var TransitionInfo = function(pixelBuffer, paletteId, playerX, playerY) {
	this.Buffer = pixelBuffer;
	this.PaletteId = paletteId;
	this.PlayerTilePos = { x: playerX, y: playerY };
	this.PlayerCenter = { x: Math.floor((playerX * tilesize) + (tilesize / 2)), y: Math.floor((playerY * tilesize) + (tilesize / 2)) };
};