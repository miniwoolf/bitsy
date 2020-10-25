/* TODO
- are the rainbow colors right? try reverse engineering from old fx?
- do I actually want automatic color cycling?
*/

var COLOR_INDEX = {
	TEXTBOX : 0,
	TEXT : 1,
	RAINBOW_START : 2,
	RAINBOW_END : 11,
	TRANSPARENT : 12,
	BACKGROUND : 13,
	TILE : 14,
	SPRITE : 15,
};

var PALETTE_ID = {
	ROOM : 0,
	PREV : 1,
	FADE : 2,
};

function Color() {
	// active palette colors
	var paletteSize = 16;
	var palettes = {};

	var colorCycleOffset = 0;
	var colorCycleMin = 2;
	var colorCycleLen = 10;

	function CreateDefaultPalette() {
		var palette = [];

		// text box colors
		palette.push([0,0,0,255]);
		palette.push([255,255,255,255]);

		// NOTE: I'm keeping this comment to illustrate how I calculated the rainbow colors!
		// for (var i = 0; i < colorCycleLen; i++) {
		// 	var h = Math.sin((Math.PI * (i / (colorCycleLen + 1))) / 2);
		// 	console.log("RAINBOW HUE " + i + " -- " + h);
		// 	var rbwColor = hslToRgb(h, 1, 0.5).concat([255]);
		// 	console.log("RAINBOW HUE [" + rbwColor[0] + "," + rbwColor[1] + "," + rbwColor[2] + "," + rbwColor[3] + "]");
		// 	palette.push(rbwColor);
		// }

		// precalculated rainbow colors
		palette.push([255,0,0,255]);
		palette.push([255,217,0,255]);
		palette.push([78,255,0,255]);
		palette.push([0,255,125,255]);
		palette.push([0,192,255,255]);
		palette.push([0,18,255,255]);
		palette.push([136,0,255,255]);
		palette.push([255,0,242,255]);
		palette.push([255,0,138,255]);
		palette.push([255,0,61,255]);

		// transparent
		palette.push([0,0,0,0]);

		// default tile colors
		palette.push([0,0,0,255]);
		palette.push([255,255,255,255]);
		palette.push([255,255,255,255]);

		return palette;
	}

	// set palette to default colors
	function ResetRoomPalette() {
		palettes[PALETTE_ID.ROOM] = CreateDefaultPalette();
	}

	// todo : name?
	function ShiftedColorIndex(index, indexOffset) {
		return (index + indexOffset) % paletteSize;
	}
	this.ShiftedColorIndex = ShiftedColorIndex;

	this.LoadRoomPalette = function(pal) {
		ResetRoomPalette();

		var palette = palettes[PALETTE_ID.ROOM];

		if (pal != undefined && pal != null) {
			for (var i = 0; i < pal.colors.length; i++) {
				var index = ShiftedColorIndex(i, pal.indexOffset);
				var alpha = (index === COLOR_INDEX.TRANSPARENT) ? 0 : 255;
				palette[index] = pal.colors[i].concat([alpha]);
			}
		}
	};

	this.StoreRoomPalette = function() {
		palettes[PALETTE_ID.PREV] = palettes[PALETTE_ID.ROOM];
	};

	this.CreateFadePalette = function(clearIndex) {
		palettes[PALETTE_ID.FADE] = [];

		for (var i = 0; i < paletteSize; i++) {
			palettes[PALETTE_ID.FADE].push(palettes[PALETTE_ID.PREV][clearIndex]);
		}
	};

	function UpdateSystemPalette(paletteIdA, paletteIdB, delta) {
		bitsyPaletteRequestSize(paletteSize); // todo : do this on every update?

		if (paletteIdA === undefined || paletteIdA === null) {
			paletteIdA = PALETTE_ID.ROOM;
		}

		if (paletteIdB != undefined && paletteIdB != null && delta != undefined && delta != null) {
			for (var i = 0; i < paletteSize; i++) {
				var colorA = palettes[paletteIdA][i];
				var colorB = palettes[paletteIdB][i];
				var deltaColor = LerpColor(colorA, colorB, delta);
				bitsyPaletteSetColor(i, deltaColor[0], deltaColor[1], deltaColor[2], deltaColor[3]);
			}
		}
		else {
			for (var i = 0; i < paletteSize; i++) {
				var color = palettes[paletteIdA][i];
				bitsyPaletteSetColor(i, color[0], color[1], color[2], color[3]);
			}
		}
	}
	this.UpdateSystemPalette = UpdateSystemPalette;

	function LerpColor(colorA, colorB, delta) {
		return [colorA[0] + ((colorB[0] - colorA[0]) * delta),
			colorA[1] + ((colorB[1] - colorA[1]) * delta),
			colorA[2] + ((colorB[2] - colorA[2]) * delta),
			colorA[3] + ((colorB[3] - colorA[3]) * delta)];
	}

	function GetColorIndex(index) {
		// todo : handle index out of bounds?

		if (index >= colorCycleMin && index < (colorCycleMin + colorCycleLen)) {
			index -= colorCycleMin;
			index = (index + colorCycleOffset) % colorCycleLen;
			index += colorCycleMin;
		}

		return index;
	}
	this.GetColorIndex = GetColorIndex;

	function GetColor(index, id) {
		var palette = palettes[id ? id : PALETTE_ID.ROOM];
		return palette[GetColorIndex(index)];
	};
	this.GetColor = GetColor;

	this.Cycle = function() {
		colorCycleOffset--;

		if (colorCycleOffset < 0) {
			colorCycleOffset = colorCycleLen - 1;
		}
	}

	this.GetDefaultColor = function(index) {
		return CreateDefaultPalette()[index];
	}

	ResetRoomPalette();
	UpdateSystemPalette();
}

// TODO : put these loose functions in the color module
//hex-to-rgb method borrowed from stack overflow
function hexToRgb(hex) {
	// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
	var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
	hex = hex.replace(shorthandRegex, function(m, r, g, b) {
		return r + r + g + g + b + b;
	});

	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}
function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
	return "#" + componentToHex(Math.floor(r)) + componentToHex(Math.floor(g)) + componentToHex(Math.floor(b));
}

function hslToHex(h,s,l) {
	var rgbArr = hslToRgb(h,s,l);
	return rgbToHex( Math.floor(rgbArr[0]), Math.floor(rgbArr[1]), Math.floor(rgbArr[2]) );
}

function hexToHsl(hex) {
	var rgb = hexToRgb(hex);
	return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

// really just a vector distance
function colorDistance(a1,b1,c1,a2,b2,c2) {
	return Math.sqrt( Math.pow(a1 - a2, 2) + Math.pow(b1 - b2, 2) + Math.pow(c1 - c2, 2) );
}

function hexColorDistance(hex1,hex2) {
	var color1 = hexToRgb(hex1);
	var color2 = hexToRgb(hex2);
	return rgbColorDistance(color1.r, color1.g, color1.b, color2.r, color2.g, color2.b);
}


// source : http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c
/* accepts parameters
 * h  Object = {h:x, s:y, v:z}
 * OR 
 * h, s, v
*/
function HSVtoRGB(h, s, v) {
	var r, g, b, i, f, p, q, t;
	if (arguments.length === 1) {
		s = h.s, v = h.v, h = h.h;
	}
	i = Math.floor(h * 6);
	f = h * 6 - i;
	p = v * (1 - s);
	q = v * (1 - f * s);
	t = v * (1 - (1 - f) * s);
	switch (i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q; break;
	}
	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255)
	};
}

/* accepts parameters
 * r  Object = {r:x, g:y, b:z}
 * OR 
 * r, g, b
*/
function RGBtoHSV(r, g, b) {
	if (arguments.length === 1) {
		g = r.g, b = r.b, r = r.r;
	}
	var max = Math.max(r, g, b), min = Math.min(r, g, b),
		d = max - min,
		h,
		s = (max === 0 ? 0 : d / max),
		v = max / 255;

	switch (max) {
		case min: h = 0; break;
		case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break;
		case g: h = (b - r) + d * 2; h /= 6 * d; break;
		case b: h = (r - g) + d * 4; h /= 6 * d; break;
	}

	return {
		h: h,
		s: s,
		v: v
	};
}

// source : https://gist.github.com/mjackson/5311256
/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  l       The lightness
 * @return  Array           The RGB representation
 */
function hslToRgb(h, s, l) {
  var r, g, b;

  if (s == 0) {
	r = g = b = l; // achromatic
  } else {
	function hue2rgb(p, q, t) {
	  if (t < 0) t += 1;
	  if (t > 1) t -= 1;
	  if (t < 1/6) return p + (q - p) * 6 * t;
	  if (t < 1/2) return q;
	  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
	  return p;
	}

	var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	var p = 2 * l - q;

	r = hue2rgb(p, q, h + 1/3);
	g = hue2rgb(p, q, h);
	b = hue2rgb(p, q, h - 1/3);
  }

  return [ Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255) ];
}

/**
 * From: http://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
 *
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   {number}  r       The red color value
 * @param   {number}  g       The green color value
 * @param   {number}  b       The blue color value
 * @return  {Array}           The HSL representation
 */
function rgbToHsl(r, g, b){
	r /= 255, g /= 255, b /= 255;
	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, l = (max + min) / 2;

	if(max == min){
		h = s = 0; // achromatic
	}else{
		var d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch(max){
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h /= 6;
	}

	return [h, s, l];
}