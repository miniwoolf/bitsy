// a bit hacky to have it as a global variable but it's nice that it remembers what you did!
var globalShowTextEffectsControls = true;

function DialogTextEditor(expressionList, parentEditor) {
	var div = document.createElement("div");
	div.classList.add("dialogEditor");
	div.classList.add("actionEditor");

	var orderControls = new OrderControls(this, parentEditor);
	div.appendChild(orderControls.GetElement());

	// var span = document.createElement("div");
	// span.innerText = "dialog";
	// div.appendChild(span);

	function OnDialogTextChange() {
		// hacky :(
		var scriptStr = '"""\n' +  textArea.value + '\n"""';
		var tempDialogNode = scriptInterpreter.Parse(scriptStr);
		expressionList = tempDialogNode.children;
		parentEditor.NotifyUpdate(true);
	}

	var textSelectionChangeHandler = createOnTextSelectionChange(OnDialogTextChange);

	var dialogText = scriptNext.SerializeWrapped(expressionList);

	var textHolderDiv = document.createElement("div");
	textHolderDiv.classList.add("dialogBoxContainer");

	var textArea = document.createElement("textarea");
	textArea.value = dialogText;

	textArea.onchange = OnDialogTextChange;
	textArea.onkeyup = OnDialogTextChange;
	textArea.onblur = OnDialogTextChange;

	textArea.rows = Math.max(2, dialogText.split("\n").length + 1);
	textArea.cols = 32;

	textArea.addEventListener('click', textSelectionChangeHandler);
	textArea.addEventListener('select', textSelectionChangeHandler);
	textArea.addEventListener('blur', textSelectionChangeHandler);

	textHolderDiv.appendChild(textArea);

	textHolderDiv.onclick = function() {
		textArea.focus(); // hijack focus into the actual textarea
	}

	div.appendChild(textHolderDiv);

	// add text effects controls
	var textEffectsDiv = document.createElement("div");
	textEffectsDiv.classList.add("controlBox");
	textEffectsDiv.style.display = "none";
	textEffectsDiv.style.marginTop = "10px"; // hacky
	div.appendChild(textEffectsDiv);

	var toggleTextEffectsButton = document.createElement("button");
	toggleTextEffectsButton.appendChild(iconUtils.CreateIcon("text_effects"));
	toggleTextEffectsButton.title = "show/hide text effects controls";
	toggleTextEffectsButton.onclick = function() {
		globalShowTextEffectsControls = !globalShowTextEffectsControls;
		textEffectsDiv.style.display = globalShowTextEffectsControls ? "block" : "none";
	}
	orderControls.GetCustomControlsContainer().appendChild(toggleTextEffectsButton);

	var textEffectsTitleDiv = document.createElement("div");
	textEffectsTitleDiv.style.marginBottom = "5px";
	textEffectsTitleDiv.innerHTML = iconUtils.CreateIcon("text_effects").outerHTML + " " + localization.GetStringOrFallback("dialog_effect_new", "text effects");
	textEffectsDiv.appendChild(textEffectsTitleDiv);

	var textEffectsControlsDiv = document.createElement("div");
	textEffectsControlsDiv.style.marginBottom = "5px";
	textEffectsDiv.appendChild(textEffectsControlsDiv);

	var effectsTags = ["{clr1}", "{clr2}", "{clr3}", "{wvy}", "{shk}", "{rbw}"];
	var effectsNames = [
		localization.GetStringOrFallback("dialog_effect_color1", "color 1"),
		localization.GetStringOrFallback("dialog_effect_color2", "color 2"),
		localization.GetStringOrFallback("dialog_effect_color3", "color 3"),
		localization.GetStringOrFallback("dialog_effect_wavy", "wavy"),
		localization.GetStringOrFallback("dialog_effect_shaky", "shaky"),
		localization.GetStringOrFallback("dialog_effect_rainbow", "rainbow"),
	];

	var effectsDescriptions = [
		"text in tags matches the 1st color in the palette",
		"text in tags matches the 2nd color in the palette",
		"text in tags matches the 3rd color in the palette",
		"text in tags waves up and down",
		"text in tags shakes constantly",
		"text in tags is rainbow colored"
	]; // TODO : localize

	function CreateAddEffectHandler(tag) {
		return function() {
			wrapTextSelection(tag); // hacky to still use this?
		}
	}

	for (var i = 0; i < effectsTags.length; i++) {
		var effectButton = document.createElement("button");
		effectButton.onclick = CreateAddEffectHandler(effectsTags[i]);
		effectButton.innerText = effectsNames[i];
		effectButton.title = effectsDescriptions[i];
		textEffectsControlsDiv.appendChild(effectButton);
	}

	var textEffectsPrintDrawingDiv = document.createElement("div");
	textEffectsDiv.appendChild(textEffectsPrintDrawingDiv);

	var textEffectsPrintDrawingButton = document.createElement("button");
	textEffectsPrintDrawingButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
		+ localization.GetStringOrFallback("dialog_effect_drawing", "insert drawing");
	textEffectsPrintDrawingButton.title = "draw a sprite, tile, or item in your dialog";
	textEffectsPrintDrawingDiv.appendChild(textEffectsPrintDrawingButton);

	var textEffectsPrintDrawingSelect = document.createElement("select");
	textEffectsPrintDrawingDiv.appendChild(textEffectsPrintDrawingSelect);

	for (id in tile) {
		var option = document.createElement("option");

		var tileName = "";
		if (tile[id].name) {
			tileName += tile[id].name;
		}
		else if (getDrawingTypeFromId(id) == TileType.Avatar) {
			tileName += localization.GetStringOrFallback("avatar_label", "avatar");
		}
		else {
			if (getDrawingTypeFromId(id) == TileType.Sprite) {
				tileName += localization.GetStringOrFallback("sprite_label", "sprite");
			}
			else if (getDrawingTypeFromId(id) == TileType.Tile) {
				tileName += localization.GetStringOrFallback("tile_label", "tile");
			}
			else if (getDrawingTypeFromId(id) == TileType.Item) {
				tileName += localization.GetStringOrFallback("item_label", "item");
			}

			tileName += " " + id;
		}

		option.innerText = tileName;

		option.value = '{printSprite "' + id + '"}'; // TODO : replace with "printDrawing"

		textEffectsPrintDrawingSelect.appendChild(option);
	}

	textEffectsPrintDrawingButton.onclick = function() {
		textArea.value += textEffectsPrintDrawingSelect.value;

		OnDialogTextChange();
	}

	this.GetElement = function() {
		return div;
	}

	AddSelectionBehavior(
		this,
		function() { textEffectsDiv.style.display = globalShowTextEffectsControls ? "block" : "none"; },
		function() { textEffectsDiv.style.display = "none"; });

	this.GetNodes = function() {
		return expressionList;
	}

	this.OnNodeEnter = function(event) {
		if (event.id != undefined) {
			var enterIndex = expressionList.findIndex(function(node) { return node.GetId() === event.id });
			if (enterIndex == 0) {
				div.classList.add("executing");
			}
		}
	};

	this.OnNodeExit = function(event) {
		if (event.id != undefined) {
			var exitIndex = expressionList.findIndex(function(node) { return node.GetId() === event.id });
			if (exitIndex >= expressionList.length-1 || event.forceClear) {
				div.classList.remove("executing");
				div.classList.remove("executingLeave");
				void div.offsetWidth; // hack to force reflow to allow animation to restart
				div.classList.add("executingLeave");
				setTimeout(function() { div.classList.remove("executingLeave") }, 1100);
			}
		}
	};
}


// todo : refactor? remove?
var dialogSel = {
	target : null,
	start : 0,
	end : 0,
	onchange : null
}

function createOnTextSelectionChange(onchange) {
	return function(event) {
		dialogSel.target = event.target;
		dialogSel.start = event.target.selectionStart;
		dialogSel.end = event.target.selectionEnd;
		dialogSel.onchange = onchange;

		var effectButtons = document.getElementsByClassName("dialogEffectButton");
		for(var i = 0; i < effectButtons.length; i++) {
			effectButtons[i].disabled = false;
		}
	}
}

function preventTextDeselect(event) {
	if(dialogSel.target != null) {
		// event.preventDefault();
	}
}

function preventTextDeselectAndClick(event) {
	if(dialogSel.target != null) {
		// event.preventDefault();
		event.target.click();
	}
}

function wrapTextSelection(effect) {
	if( dialogSel.target != null ) {
		var curText = dialogSel.target.value;
		var selText = curText.slice(dialogSel.start, dialogSel.end);

		var isEffectAlreadyApplied = selText.indexOf( effect ) > -1;
		if(isEffectAlreadyApplied) {
			//remove all instances of effect
			var effectlessText = selText.split( effect ).join( "" );
			var newText = curText.slice(0, dialogSel.start) + effectlessText + curText.slice(dialogSel.end);
			dialogSel.target.value = newText;
			dialogSel.target.setSelectionRange(dialogSel.start,dialogSel.start + effectlessText.length);
			if(dialogSel.onchange != null)
				dialogSel.onchange( dialogSel ); // dialogSel needs to mimic the event the onchange would usually receive
		}
		else {
			// add effect
			var effectText = effect + selText + effect;
			var newText = curText.slice(0, dialogSel.start) + effectText + curText.slice(dialogSel.end);
			dialogSel.target.value = newText;
			dialogSel.target.setSelectionRange(dialogSel.start,dialogSel.start + effectText.length);
			if(dialogSel.onchange != null)
				dialogSel.onchange( dialogSel ); // dialogSel needs to mimic the event the onchange would usually receive
		}
	}
}