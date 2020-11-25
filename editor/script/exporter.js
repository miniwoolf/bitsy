function Exporter() {

/* exporting */
function escapeSpecialCharacters(str) {
	str = str.replace(/\\/g, '\\\\');
	str = str.replace(/"/g, '\\"');
	return str;
}

function replaceTemplateMarker(template, marker, text) {
	var markerIndex = template.indexOf( marker );
	return template.substr( 0, markerIndex ) + text + template.substr( markerIndex + marker.length );
}

function insertIntoTemplate(template, resourceId, tag) {
	var templateMarkerComment = "<!-- {" + resourceId + "} -->";
	var resourceInTag = "<" + tag + ">" + "\n" + Resources[resourceId] + "\n" + "</" + tag + ">";
	return replaceTemplateMarker(template, templateMarkerComment, resourceInTag);
}

this.exportGame = function(gameData, title, pageColor, filename, isFixedSize, size) {
	var html = Resources["exportTemplate.html"].substr(); //copy template
	// console.log(html);

	html = replaceTemplateMarker(html, "{title}", title);

	if( isFixedSize ) {
		html = replaceTemplateMarker(html, "{export_style}", Resources["exportStyleFixed.css"]);
		html = replaceTemplateMarker(html, "{game_size}", size + "px");
	}
	else {
		html = replaceTemplateMarker(html, "{export_style}", Resources["exportStyleFull.css"]);
	}

	html = replaceTemplateMarker(html, "{background_color}", pageColor);

	// scripts
	html = insertIntoTemplate(html, "core_render.js", "script");
	html = insertIntoTemplate(html, "spec.js", "script");
	html = insertIntoTemplate(html, "keyword.js", "script");
	html = insertIntoTemplate(html, "id.js", "script");
	html = insertIntoTemplate(html, "parser.js", "script");
	html = insertIntoTemplate(html, "color.js", "script");
	html = insertIntoTemplate(html, "font.js", "script");
	html = insertIntoTemplate(html, "transition.js", "script");
	html = insertIntoTemplate(html, "library.js", "script");
	html = insertIntoTemplate(html, "script_next.js", "script");
	html = insertIntoTemplate(html, "dialog.js", "script");
	html = insertIntoTemplate(html, "renderer.js", "script");
	html = insertIntoTemplate(html, "bitsy.js", "script");

	// export the default font in its own script tag (TODO : remove if unused)
	html = replaceTemplateMarker(html, "{default_font_data_id}", "ascii_small");
	html = replaceTemplateMarker(html, "{default_font_data}", fontManager.GetData("ascii_small"));

	html = replaceTemplateMarker(html, "{game_data}", gameData);

	// console.log(html);

	ExporterUtils.DownloadFile( filename, html );
}


/* importing */
function unescapeSpecialCharacters(str) {
	str = str.replace(/\\"/g, '"');
	str = str.replace(/\\\\/g, '\\');
	return str;
}

this.importGame = function( html ) {
	console.log("IMPORT!!!");

	// IMPORT : old style
	// find start of game data
	var i = html.indexOf("var exportedGameData");
	if(i > -1) {
		console.log("OLD STYLE");

		while ( html.charAt(i) != '"' ) {
			i++; // move to first quote
		}
		i++; // move past first quote

		// isolate game data
		var gameDataStr = "";
		var isEscapeChar = false;
		while ( html.charAt(i) != '"' || isEscapeChar ) {
			gameDataStr += html.charAt(i);
			isEscapeChar = html.charAt(i) == "\\";
			i++;
		}

		// replace special characters
		gameDataStr = gameDataStr.replace(/\\n/g, "\n"); //todo: move this into the method below
		gameDataStr = unescapeSpecialCharacters( gameDataStr );

		return gameDataStr;		
	}

	// IMPORT : new style
	var scriptStart = '<script type="bitsyGameData" id="exportedGameData">\n';
	var scriptEnd = '</script>';

	// this is kind of embarassing, but I broke import by making the export template pass w3c validation
	// so we have to check for two slightly different versions of the script start line :(
	i = html.indexOf( scriptStart );
	if (i === -1) {
		scriptStart = '<script type="text/bitsyGameData" id="exportedGameData">\n';
		i = html.indexOf( scriptStart );
	}

	if(i > -1) {
		i = i + scriptStart.length;
		var gameStr = "";
		var lineStr = "";
		var isDone = false;
		while(!isDone && i < html.length) {

			lineStr += html.charAt(i);

			if(html.charAt(i) === "\n") {
				if(lineStr === scriptEnd) {
					isDone = true;
				}
				else {
					gameStr += lineStr;
					lineStr = "";
				}
			}

			i++;
		}
		return gameStr;
	}

	console.log("FAIL!!!!");

	return "";
}

} // Exporter()

var ExporterUtils = {
	DownloadFile : function(filename, text) {

		if( browserFeatures.blobURL ) {
			// new blob version
			var a = document.createElement('a');
			var blob = new Blob( [text] );
			a.download = filename;
			a.href = makeURL.createObjectURL(blob);
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		}
		else {
			// old version
			var element = document.createElement('a');

			element.setAttribute('href', 'data:attachment/file;charset=utf-8,' + encodeURIComponent(text));

			element.setAttribute('download', filename);
			element.setAttribute('target', '_blank');

			element.style.display = 'none';
			document.body.appendChild(element);

			element.click();

			document.body.removeChild(element);
		}
	}
}