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

	// add text effects root
	var textEffectsDiv = document.createElement("div");
	textEffectsDiv.classList.add("controlBox");
	textEffectsDiv.style.display = "none";
	textEffectsDiv.style.marginBottom = "10px"; // hacky
	div.appendChild(textEffectsDiv);

	function OnDialogTextChange() {
		console.log("TEXT CHANGE!!!");
		// a bit wonky
		var tempDialogExpression = scriptNext.Parse(textArea.value, true);
		expressionList = tempDialogExpression.list.slice(1);
		parentEditor.NotifyUpdate(true);
	}

	var textSelectionChangeHandler = createOnTextSelectionChange(OnDialogTextChange);

	var dialogText = scriptNext.SerializeWrapped(expressionList);

	var textHolderDiv = document.createElement("div");
	textHolderDiv.classList.add("dialogBoxContainer");

	var textArea = document.createElement("textarea");
	textArea.spellcheck = false;
	textArea.value = dialogText;

	textArea.onchange = OnDialogTextChange;
	textArea.onkeyup = OnDialogTextChange;
	textArea.onblur = OnDialogTextChange;

	textArea.rows = Math.max(2, dialogText.split("\n").length + 1);

	textArea.addEventListener('click', textSelectionChangeHandler);
	textArea.addEventListener('select', textSelectionChangeHandler);
	textArea.addEventListener('blur', textSelectionChangeHandler);

	textHolderDiv.appendChild(textArea);

	textHolderDiv.onclick = function() {
		textArea.focus(); // hijack focus into the actual textarea
	}

	div.appendChild(textHolderDiv);

	// add text effects controls
	var toggleTextEffectsButton = document.createElement("button");
	toggleTextEffectsButton.appendChild(iconUtils.CreateIcon("text_effects"));
	toggleTextEffectsButton.title = "show/hide text effects controls";
	toggleTextEffectsButton.onclick = function() {
		globalShowTextEffectsControls = !globalShowTextEffectsControls;
		UpdateTextEffectsControls(globalShowTextEffectsControls);
	}
	orderControls.GetCustomControlsContainer().appendChild(toggleTextEffectsButton);

	var textEffectsTitleDiv = document.createElement("div");
	textEffectsTitleDiv.style.marginBottom = "5px";
	textEffectsTitleDiv.innerHTML = iconUtils.CreateIcon("text_effects").outerHTML + " " + localization.GetStringOrFallback("dialog_effect_new", "text effects");
	textEffectsDiv.appendChild(textEffectsTitleDiv);

	var textEffectsControlsDiv = document.createElement("div");
	textEffectsControlsDiv.style.marginBottom = "5px";
	textEffectsDiv.appendChild(textEffectsControlsDiv);

	var textEffects = [
		{
			name: localization.GetStringOrFallback("dialog_effect_color1", "color 1"),
			description: "text in tags matches the 1st color in the palette", // todo : localize these!
			iconId: "colors",
			tagOpen : "{CLR 0}",
			tagClose : "{/CLR}",
			styleName : paletteTool ? paletteTool.GetStyle(0) : null,
			backgroundColor : paletteTool ? paletteTool.GetBackgroundColor(0) : null,
		},
		{
			name: localization.GetStringOrFallback("dialog_effect_color2", "color 2"),
			description: "text in tags matches the 2nd color in the palette",
			iconId: "colors",
			tagOpen : "{CLR 1}",
			tagClose : "{/CLR}",
			styleName : paletteTool ? paletteTool.GetStyle(1) : null,
			backgroundColor : paletteTool ? paletteTool.GetBackgroundColor(1) : null,
		},
		{
			name: localization.GetStringOrFallback("dialog_effect_color3", "color 3"),
			description: "text in tags matches the 3rd color in the palette",
			iconId: "colors",
			tagOpen : "{CLR 2}",
			tagClose : "{/CLR}",
			styleName : paletteTool ? paletteTool.GetStyle(2) : null,
			backgroundColor : paletteTool ? paletteTool.GetBackgroundColor(2) : null,
		},
		{
			name: "WVY", //localization.GetStringOrFallback("dialog_effect_wavy", "wavy"),
			description: "text in tags waves up and down",
			iconId: null,
			tagOpen : "{WVY}",
			tagClose : "{/WVY}",
			styleName: "textEffectWvyHover",
		},
		{
			name: "SHK", //localization.GetStringOrFallback("dialog_effect_shaky", "shaky"),
			description: "text in tags shakes constantly",
			iconId: null,
			tagOpen : "{SHK}",
			tagClose : "{/SHK}",
			styleName: "textEffectShkHover",
		},
		{
			name: "RBW", //localization.GetStringOrFallback("dialog_effect_rainbow", "rainbow"),
			description: "text in tags is rainbow colored",
			iconId: null,
			tagOpen : "{RBW}",
			tagClose : "{/RBW}",
			styleName: "textEffectRbwHover",
		},
	];

	function CreateAddEffectHandler(tagOpen, tagClose) {
		return function() {
			wrapTextSelection(tagOpen, tagClose); // hacky to still use this?
		}
	}

	for (var i = 0; i < textEffects.length; i++) {
		var effect = textEffects[i];

		var effectButton = document.createElement("button");
		effectButton.onclick = CreateAddEffectHandler(effect.tagOpen, effect.tagClose);

		if (effect.iconId != null && iconUtils != null) {
			effectButton.appendChild(iconUtils.CreateIcon(effect.iconId));
		}
		else {
			effectButton.innerText = effect.name;
		}

		effectButton.title = effect.description;

		if (effect.backgroundColor) {
			effectButton.style.background = effect.backgroundColor;
		}

		if (effect.styleName) {
			effectButton.setAttribute("class", effect.styleName);
		}

		textEffectsControlsDiv.appendChild(effectButton);
	}

	var textEffectsPrintDrawingSpan = document.createElement("span");
	textEffectsPrintDrawingSpan.classList.add("textEffectDrwSelect");
	textEffectsControlsDiv.appendChild(textEffectsPrintDrawingSpan);

	function TryUpdateTextEffectDrwSelectControls() {
		if (findTool) {
			textEffectsPrintDrawingSpan.innerHTML = "";

			var textEffectsPrintDrawingButton = document.createElement("button");
			textEffectsPrintDrawingButton.appendChild(iconUtils.CreateIcon("paint"));
			textEffectsPrintDrawingButton.title = "draw a tile in your dialog";
			textEffectsPrintDrawingSpan.appendChild(textEffectsPrintDrawingButton);

			var seperatorSpan = document.createElement("span");
			seperatorSpan.innerText = ":";
			seperatorSpan.style.marginLeft = "2px"; // hacky styles..
			seperatorSpan.style.marginRight = "4px";
			textEffectsPrintDrawingSpan.appendChild(seperatorSpan);

			var textEffectDrwId = "A"; // todo : is this ok?

			var textEffectDrwSelect = findTool.CreateSelectControl(
				"drawing",
				{
					onSelectChange : function(id) {
						textEffectDrwId = id;
					},
					filters : ["avatar", "sprite", "tile", "item", "exit", "ending"],
					toolId : "dialogPanel",
					getSelectMessage : function() {
						// todo : localize
						return "select drawing";
					},
					// showDropdown : false, // todo : show or not?
					showOpenTool : false,
				});

			textEffectDrwSelect.SetSelection(textEffectDrwId);

			textEffectsPrintDrawingSpan.appendChild(textEffectDrwSelect.GetElement());

			textEffectsPrintDrawingButton.onclick = function() {
				textArea.value += '{DRW "' + textEffectDrwId + '"}';
				OnDialogTextChange();
			};
		}
	}

	function UpdateTextEffectsControls(visible) {
		textEffectsDiv.style.display = visible ? "block" : "none";

		if (visible) {
			TryUpdateTextEffectDrwSelectControls();
		}
	}

	this.GetElement = function() {
		return div;
	}

	AddSelectionBehavior(
		this,
		function() { UpdateTextEffectsControls(globalShowTextEffectsControls); },
		function() { textEffectsDiv.style.display = "none"; });

	this.GetExpressionList = function() {
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
	if (dialogSel.target != null) {
		// event.preventDefault();
	}
}

function preventTextDeselectAndClick(event) {
	if (dialogSel.target != null) {
		// event.preventDefault();
		event.target.click();
	}
}

function wrapTextSelection(tagOpen, tagClose) {
	if (dialogSel.target != null) {
		var curText = dialogSel.target.value;
		var selText = curText.slice(dialogSel.start, dialogSel.end);

		var isEffectAlreadyApplied = selText.startsWith(tagOpen) && selText.endsWith(tagClose);

		if (isEffectAlreadyApplied) {
			//remove all instances of effect
			var effectlessText = selText.substring(tagOpen.length, selText.length - tagClose.length);
			var newText = curText.slice(0, dialogSel.start) + effectlessText + curText.slice(dialogSel.end);
			dialogSel.target.value = newText;
			dialogSel.target.setSelectionRange(dialogSel.start,dialogSel.start + effectlessText.length);

			if (dialogSel.onchange != null) {
				dialogSel.onchange(dialogSel); // dialogSel needs to mimic the event the onchange would usually receive
			}
		}
		else {
			// add effect
			var effectText = tagOpen + selText + tagClose;
			var newText = curText.slice(0, dialogSel.start) + effectText + curText.slice(dialogSel.end);
			dialogSel.target.value = newText;
			dialogSel.target.setSelectionRange(dialogSel.start,dialogSel.start + effectText.length);

			if (dialogSel.onchange != null) {
				dialogSel.onchange(dialogSel); // dialogSel needs to mimic the event the onchange would usually receive
			}
		}
	}
}